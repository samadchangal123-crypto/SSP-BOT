const axios = require('axios');

const processedMessages = new Set();

async function fetchFromAnabot(url) {
    const encoded = encodeURIComponent(url);
    const res = await axios.get(`https://anabot.my.id/api/download/instagram?url=${encoded}&apikey=freeApikey`, {
        timeout: 15000,
        headers: { 'accept': 'application/json' }
    });
    const data = res.data;
    if (!data || !data.success) return null;
    const items = data.data || data.result || data.medias || [];
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.map(i => ({ url: i.url || i.link, type: i.type || (i.url && /\.mp4/i.test(i.url) ? 'video' : 'image') }));
}

async function fetchFromRyzen(url) {
    const encoded = encodeURIComponent(url);
    const res = await axios.get(`https://api.ryzendesu.xyz/api/downloader/igdl?url=${encoded}`, {
        timeout: 15000,
        headers: { 'accept': 'application/json' }
    });
    const data = res.data;
    if (!data || !data.status) return null;
    const items = data.data || [];
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.map(i => ({ url: i.url || i.link, type: i.type || (i.url && /\.mp4/i.test(i.url) ? 'video' : 'image') }));
}

async function fetchFromSiputzx(url) {
    const encoded = encodeURIComponent(url);
    const res = await axios.get(`https://api.siputzx.my.id/api/d/igdl?url=${encoded}`, {
        timeout: 15000,
        headers: { 'accept': 'application/json' }
    });
    const data = res.data;
    if (!data || !data.status) return null;
    const items = data.data || [];
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.map(i => ({ url: i.url || i.link, type: i.type || (i.url && /\.mp4/i.test(i.url) ? 'video' : 'image') }));
}

async function fetchFromRuhend(url) {
    try {
        const { igdl } = require('ruhend-scraper');
        const result = await igdl(url);
        if (!result || !result.data || result.data.length === 0) return null;
        return result.data
            .filter(i => i.url)
            .map(i => ({ url: i.url, type: i.type || (i.url && /\.mp4/i.test(i.url) ? 'video' : 'image') }));
    } catch {
        return null;
    }
}

async function getInstagramMedia(url, isReel) {
    const apis = [fetchFromAnabot, fetchFromRyzen, fetchFromSiputzx, fetchFromRuhend];
    for (const apiFn of apis) {
        try {
            const result = await apiFn(url);
            if (result && result.length > 0) {
                return result;
            }
        } catch (err) {
            console.log(`[IG] API ${apiFn.name} failed:`, err.message);
        }
    }
    return null;
}

async function instagramCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, {
                text: '📌 Instagram link bhejo.\nMisal: .ig https://www.instagram.com/reel/...'
            }, { quoted: message });
        }

        const instagramPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\/p\//,
            /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
            /https?:\/\/(?:www\.)?instagram\.com\/tv\//,
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//
        ];

        const linkMatch = text.match(/https?:\/\/\S+/);
        const igUrl = linkMatch ? linkMatch[0] : text;
        const isValidUrl = instagramPatterns.some(p => p.test(igUrl));

        if (!isValidUrl) {
            return await sock.sendMessage(chatId, {
                text: '❌ Valid Instagram link nahi hai. Post, Reel ya Video ka link do.'
            }, { quoted: message });
        }

        const isReel = igUrl.includes('/reel/') || igUrl.includes('/tv/');

        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });
        await sock.sendMessage(chatId, {
            text: '⏳ Downloading... thoda wait karo...'
        }, { quoted: message });

        const mediaList = await getInstagramMedia(igUrl, isReel);

        if (!mediaList || mediaList.length === 0) {
            return await sock.sendMessage(chatId, {
                text: '❌ Media nahi mili. Post private ho sakti hai ya link galat hai.\nDobara try karo.'
            }, { quoted: message });
        }

        const seenUrls = new Set();
        const uniqueMedia = mediaList.filter(m => {
            if (!m.url || seenUrls.has(m.url)) return false;
            seenUrls.add(m.url);
            return true;
        }).slice(0, 10);

        for (let i = 0; i < uniqueMedia.length; i++) {
            try {
                const media = uniqueMedia[i];
                const mediaUrl = media.url;
                const isVideo = media.type === 'video' ||
                    /\.(mp4|mov|avi|mkv|webm)/i.test(mediaUrl) ||
                    isReel;

                if (isVideo) {
                    await sock.sendMessage(chatId, {
                        video: { url: mediaUrl },
                        mimetype: 'video/mp4',
                        caption: '✅ *Downloaded by RDX BOT* 🤖'
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: mediaUrl },
                        caption: '✅ *Downloaded by RDX BOT* 🤖'
                    }, { quoted: message });
                }

                if (i < uniqueMedia.length - 1) {
                    await new Promise(r => setTimeout(r, 1500));
                }
            } catch (err) {
                console.error(`[IG] Media ${i + 1} send error:`, err.message);
            }
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[IG] Command error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ Instagram download mein error aayi. Dobara try karo.'
        }, { quoted: message });
    }
}

module.exports = instagramCommand;
