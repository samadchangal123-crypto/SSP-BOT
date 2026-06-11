const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try { return await getter(); } catch (err) {
            lastError = err;
            if (i < attempts) await new Promise(r => setTimeout(r, 1000 * i));
        }
    }
    throw lastError;
}

async function getYupraVideoByUrl(url) {
    const res = await tryRequest(() => axios.get(`https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return { download: res.data.data.download_url, title: res.data.data.title, thumbnail: res.data.data.thumbnail };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuVideoByUrl(url) {
    const res = await tryRequest(() => axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`, AXIOS_DEFAULTS));
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu returned no download');
}

async function getSiputzxVideoByUrl(url) {
    const res = await tryRequest(() => axios.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`, AXIOS_DEFAULTS));
    if (res?.data?.status && res?.data?.data?.url) {
        return { download: res.data.data.url, title: res.data.data.title };
    }
    throw new Error('Siputzx returned no download');
}

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text ? text.split(' ').slice(1).join(' ').trim() : '';

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { text: 'What video do you want to download?' }, { quoted: message });
        }

        const isUrl = searchQuery.startsWith('http://') || searchQuery.startsWith('https://');
        let videoTitle = '';
        let videoThumbnail = '';

        if (!isUrl) {
            await sock.sendMessage(chatId, { text: `🔍 Searching: *${searchQuery}*...` }, { quoted: message });

            const { videos } = await yts(searchQuery);
            if (!videos?.length) {
                return await sock.sendMessage(chatId, { text: '❌ No results found!' }, { quoted: message });
            }
            searchQuery = videos[0].url;
            videoTitle = videos[0]?.title;
            videoThumbnail = videos[0]?.thumbnail;
        }

        const videoUrl = searchQuery;

        try {
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : undefined);
            if (thumb) {
                await sock.sendMessage(chatId, {
                    image: { url: thumb },
                    caption: `*${videoTitle || searchQuery}*\nDownloading...`
                }, { quoted: message });
            }
        } catch (e) { console.error('[VIDEO] thumb error:', e?.message); }

        const urls = videoUrl.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
        if (!urls) {
            return await sock.sendMessage(chatId, { text: '❌ This is not a valid YouTube link!' }, { quoted: message });
        }

        let videoData;
        const apiMethods = [
            { name: 'Yupra', fn: () => getYupraVideoByUrl(videoUrl) },
            { name: 'Okatsu', fn: () => getOkatsuVideoByUrl(videoUrl) },
            { name: 'Siputzx', fn: () => getSiputzxVideoByUrl(videoUrl) }
        ];

        for (const api of apiMethods) {
            try {
                videoData = await api.fn();
                if (videoData?.download) break;
            } catch (err) {
                console.log(`${api.name} failed: ${err.message}`);
            }
        }

        if (!videoData?.download) throw new Error('All video APIs failed.');

        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${(videoData.title || videoTitle || 'video').replace(/[^\w\s-]/g, '')}.mp4`,
            caption: `*${videoData.title || videoTitle || 'Video'}*\n\n> *_Downloaded By RDX BOT_*`
        }, { quoted: message });

    } catch (err) {
        console.error('[VIDEO] Command Error:', err?.message);
        await sock.sendMessage(chatId, { text: '❌ Download failed: ' + (err?.message || 'Unknown error') }, { quoted: message });
    }
}

module.exports = videoCommand;
