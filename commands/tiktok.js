const axios = require('axios');

const processedMessages = new Set();

async function fetchFromAnabot(url) {
    const res = await axios.get(`https://anabot.my.id/api/download/tiktok?url=${encodeURIComponent(url)}&apikey=freeApikey`, {
        timeout: 15000,
        headers: { 'accept': 'application/json' }
    });
    const data = res.data;
    if (!data || !data.success) return null;
    const result = data.data?.result;
    if (!result) return null;
    return {
        videoUrl: result.nowatermark || result.video || null,
        audioUrl: result.audio || null,
        thumbnail: result.thumbnail || null,
        title: result.description || '',
        username: result.username || ''
    };
}

async function fetchFromSiputzx(url) {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`, {
        timeout: 15000,
        headers: { 'accept': '*/*', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.data?.status) return null;
    const d = res.data.data;
    if (!d) return null;
    const videoUrl = d.urls?.[0] || d.video_url || d.url || d.download_url;
    if (!videoUrl) return null;
    return { videoUrl, audioUrl: null, thumbnail: null, title: d.metadata?.title || '', username: '' };
}

async function fetchFromRyzen(url) {
    const res = await axios.get(`https://api.ryzendesu.xyz/api/downloader/ttdl?url=${encodeURIComponent(url)}`, {
        timeout: 15000,
        headers: { 'accept': 'application/json' }
    });
    const data = res.data;
    if (!data || !data.status) return null;
    const videoUrl = data.data?.video?.noWatermark || data.data?.video?.watermark || null;
    if (!videoUrl) return null;
    return { videoUrl, audioUrl: data.data?.music || null, thumbnail: null, title: data.data?.title || '', username: data.data?.author || '' };
}

async function fetchFromRuhend(url) {
    const { ttdl } = require('ruhend-scraper');
    const downloadData = await ttdl(url);
    if (!downloadData?.data?.length) return null;
    const media = downloadData.data.find(m => /\.(mp4)/i.test(m.url) || m.type === 'video');
    if (!media) return null;
    return { videoUrl: media.url, audioUrl: null, thumbnail: null, title: '', username: '' };
}

async function getTikTokData(url) {
    const apis = [fetchFromAnabot, fetchFromSiputzx, fetchFromRyzen, fetchFromRuhend];
    for (const apiFn of apis) {
        try {
            const result = await apiFn(url);
            if (result && result.videoUrl) {
                console.log(`[TT] Success via ${apiFn.name}`);
                return result;
            }
        } catch (err) {
            console.log(`[TT] ${apiFn.name} failed:`, err.message);
        }
    }
    return null;
}

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: '📌 TikTok link bhejo.\nMisal: .tt https://vt.tiktok.com/...'
            }, { quoted: message });
        }

        const linkMatch = text.match(/https?:\/\/\S+/);
        const url = linkMatch ? linkMatch[0] : text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: '📌 TikTok link bhejo.\nMisal: .tt https://vt.tiktok.com/...'
            }, { quoted: message });
        }

        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        if (!tiktokPatterns.some(p => p.test(url))) {
            return await sock.sendMessage(chatId, {
                text: '❌ Valid TikTok link nahi hai. Sahi link do.'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });
        await sock.sendMessage(chatId, {
            text: '⏳ TikTok video download ho raha hai... thoda wait karo.'
        }, { quoted: message });

        const data = await getTikTokData(url);

        if (!data || !data.videoUrl) {
            return await sock.sendMessage(chatId, {
                text: '❌ Video download nahi hui. Link check karo aur dobara try karo.'
            }, { quoted: message });
        }

        const caption = [
            '✅ *Downloaded by RDX BOT* 🤖',
            data.username ? `👤 ${data.username}` : '',
            data.title ? `📝 ${data.title.slice(0, 200)}` : ''
        ].filter(Boolean).join('\n');

        try {
            await sock.sendMessage(chatId, {
                video: { url: data.videoUrl },
                mimetype: 'video/mp4',
                caption
            }, { quoted: message });
        } catch (err) {
            console.error('[TT] URL send failed, trying buffer:', err.message);
            const videoRes = await axios.get(data.videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://www.tiktok.com/'
                }
            });
            await sock.sendMessage(chatId, {
                video: Buffer.from(videoRes.data),
                mimetype: 'video/mp4',
                caption
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[TT] Command error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ TikTok download mein error aayi. Dobara try karo.'
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;
