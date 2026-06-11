const axios = require('axios');

const processedMessages = new Set();

function isValidFbUrl(url) {
    const patterns = [
        /https?:\/\/(?:www\.|m\.)?facebook\.com\/watch/,
        /https?:\/\/(?:www\.|m\.)?facebook\.com\/.*\/videos\//,
        /https?:\/\/(?:www\.|m\.)?facebook\.com\/share\/(v|r)\//,
        /https?:\/\/(?:www\.|m\.)?facebook\.com\/reel\//,
        /https?:\/\/(?:www\.|m\.)?facebook\.com\/video/,
        /https?:\/\/(?:www\.|m\.)?fb\.com\//,
        /https?:\/\/fb\.watch\//,
    ];
    return patterns.some(p => p.test(url));
}

async function fetchFromRyzen(url) {
    const res = await axios.get(`https://api.ryzendesu.xyz/api/downloader/fbdl?url=${encodeURIComponent(url)}`, {
        timeout: 20000,
        headers: { 'accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    const data = res.data;
    if (!data || !data.status) return null;
    const links = data.data || data.result || [];
    if (!Array.isArray(links) || links.length === 0) return null;
    const hd = links.find(i => i.quality?.toLowerCase().includes('hd')) || links[0];
    if (!hd?.url) return null;
    return { videoUrl: hd.url, quality: hd.quality || 'HD', title: data.title || '', source: 'ryzen' };
}

async function fetchFromSiputzx(url) {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`, {
        timeout: 20000,
        headers: { 'accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    const data = res.data;
    if (!data || !data.status) return null;
    const d = data.data || data.result;
    if (!d) return null;
    const videoUrl = d.hd || d.sd || d.url || d.video_url || (Array.isArray(d) && d[0]?.url);
    if (!videoUrl) return null;
    return { videoUrl, quality: d.hd ? 'HD' : 'SD', title: d.title || '', source: 'siputzx' };
}

async function fetchFromAnabot(url) {
    const res = await axios.get(`https://anabot.my.id/api/download/facebook?url=${encodeURIComponent(url)}&apikey=freeApikey`, {
        timeout: 20000,
        headers: { 'accept': 'application/json' }
    });
    const api = res.data?.data?.result?.api;
    if (!api || api.status === 'error' || !api.mediaItems) return null;
    const items = Array.isArray(api.mediaItems) ? api.mediaItems : [];
    if (items.length === 0) return null;
    const hd = items.find(i => i.quality?.toLowerCase().includes('hd')) || items[0];
    if (!hd?.url) return null;
    return { videoUrl: hd.url, quality: hd.quality || 'HD', title: api.title || '', source: 'anabot' };
}

async function fetchFromScraper(url) {
    const { facebookdl } = require('@bochilteam/scraper-facebook');
    const data = await facebookdl(url);
    if (!data?.video || !Array.isArray(data.video) || data.video.length === 0) return null;
    const videoOption = data.video[0];
    if (!videoOption?.download) return null;
    const videoData = await videoOption.download();
    let videoUrl = null;
    let videoBuffer = null;
    if (typeof videoData === 'string') videoUrl = videoData;
    else if (Buffer.isBuffer(videoData)) videoBuffer = videoData;
    else if (videoData?.url) videoUrl = videoData.url;
    else if (videoData?.data) videoBuffer = Buffer.from(videoData.data);
    else return null;
    return { videoUrl, videoBuffer, quality: videoOption.quality || 'HD', title: data.title || '', source: 'scraper' };
}

async function getFacebookVideo(url) {
    const apis = [fetchFromRyzen, fetchFromSiputzx, fetchFromAnabot, fetchFromScraper];
    for (const apiFn of apis) {
        try {
            const result = await apiFn(url);
            if (result && (result.videoUrl || result.videoBuffer)) {
                console.log(`[FB] Success via ${apiFn.name}`);
                return result;
            }
        } catch (err) {
            console.log(`[FB] ${apiFn.name} failed:`, err.message);
        }
    }
    return null;
}

async function fetchVideoBuffer(videoUrl) {
    const res = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: 150 * 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://www.facebook.com/'
        }
    });
    return Buffer.from(res.data);
}

async function facebookCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation
            || message.message?.extendedTextMessage?.text
            || '';

        const linkMatch = text.match(/https?:\/\/\S+/);
        const url = linkMatch ? linkMatch[0] : text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `📥 *Facebook Video Downloader*\n\n` +
                    `*Use karo:* .fb <Facebook video link>\n\n` +
                    `*Supported:*\n` +
                    `› facebook.com/watch?v=...\n` +
                    `› facebook.com/reel/...\n` +
                    `› facebook.com/share/v/...\n` +
                    `› fb.watch/...\n\n` +
                    `*Misal:*\n` +
                    `.fb https://www.facebook.com/reel/684552273643654`
            }, { quoted: message });
        }

        if (!isValidFbUrl(url)) {
            return await sock.sendMessage(chatId, {
                text: `❌ Valid Facebook video link nahi hai.\n\nMisal: .fb https://www.facebook.com/reel/...`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '⏳ Facebook video download ho raha hai... thoda wait karo.'
        }, { quoted: message });

        const result = await getFacebookVideo(url);

        if (!result) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
            return await sock.sendMessage(chatId, {
                text: `❌ *Download fail ho gaya!*\n\nVajah:\n› Video private/restricted hai\n› Link sahi nahi hai\n› Facebook ne block kiya\n\nKoi aur public video try karo 🙏`
            }, { quoted: message });
        }

        let videoBuffer = result.videoBuffer || null;
        if (!videoBuffer && result.videoUrl) {
            try { videoBuffer = await fetchVideoBuffer(result.videoUrl); } catch (e) {
                console.error('[FB] Buffer fetch failed:', e.message);
            }
        }

        const caption = `✅ *Downloaded by RDX BOT* 🤖\n` +
            (result.title ? `\n📌 ${result.title.substring(0, 100)}\n` : '') +
            `📹 Quality: ${result.quality}`;

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }).catch(() => {});

        if (videoBuffer) {
            await sock.sendMessage(chatId, {
                video: videoBuffer, mimetype: 'video/mp4', caption
            }, { quoted: message });
        } else if (result.videoUrl) {
            try {
                await sock.sendMessage(chatId, {
                    video: { url: result.videoUrl }, mimetype: 'video/mp4', caption
                }, { quoted: message });
            } catch {
                await sock.sendMessage(chatId, {
                    text: `${caption}\n\n🔗 *Download Link:*\n${result.videoUrl}`
                }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, {
                text: '❌ Video send nahi ho saka. Thodi der baad dobara try karo.'
            }, { quoted: message });
        }

    } catch (err) {
        console.error('[FB] Command error:', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '❌ Kuch masla aa gaya! Dobara try karo 🙏'
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
