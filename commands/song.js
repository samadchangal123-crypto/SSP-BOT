const axios = require('axios');
const { toAudio } = require('../lib/converter');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const LOADING_FRAMES = [
    "🩵▰▱▱▱▱▱▱▱▱▱ 10%",
    "💙▰▰▱▱▱▱▱▱▱▱ 25%",
    "💜▰▰▰▰▱▱▱▱▱▱ 45%",
    "💖▰▰▰▰▰▰▱▱▱▱ 70%",
    "💗▰▰▰▰▰▰▰▰▰▰ 100% 😍"
];

const AXIOS_DL = {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: s => s >= 200 && s < 400,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
    }
};

// ─── API 1: anabot.my.id ───────────────────────────────────────────────────
async function getAnabotAudio(query) {
    const res = await axios.get(
        `https://anabot.my.id/api/download/playmusic?query=${encodeURIComponent(query)}&apikey=freeApikey`,
        { timeout: 90000, headers: { Accept: 'application/json' } }
    );
    const r = res?.data?.data?.result;
    if (r?.success && r?.urls) {
        return {
            downloadUrl: r.urls,
            title: r.metadata?.title || query,
            thumbnail: r.metadata?.thumbnail || null,
            duration: r.metadata?.duration || null
        };
    }
    throw new Error('Anabot returned no URL');
}

// ─── API 2: Yupra ─────────────────────────────────────────────────────────
async function getYupraAudio(query) {
    const yts = require('yt-search');
    const search = await yts(query);
    const video = search?.videos?.[0];
    if (!video) throw new Error('No YT result');
    const res = await axios.get(
        `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`,
        { timeout: 60000, headers: { Accept: 'application/json' } }
    );
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            downloadUrl: res.data.data.download_url,
            title: res.data.data.title || video.title,
            thumbnail: video.thumbnail,
            duration: video.duration?.seconds
        };
    }
    throw new Error('Yupra returned no URL');
}

// ─── API 3: Keith ─────────────────────────────────────────────────────────
async function getKeithAudio(query) {
    const yts = require('yt-search');
    const search = await yts(query);
    const video = search?.videos?.[0];
    if (!video) throw new Error('No YT result');
    const res = await axios.get(
        `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(video.url)}`,
        { timeout: 60000, headers: { Accept: 'application/json' } }
    );
    if (res?.data?.status && res?.data?.result?.downloadUrl) {
        return {
            downloadUrl: res.data.result.downloadUrl,
            title: res.data.result.title || video.title,
            thumbnail: video.thumbnail
        };
    }
    throw new Error('Keith returned no URL');
}

// ─── API 4: Siputzx ───────────────────────────────────────────────────────
async function getSiputzxAudio(query) {
    const yts = require('yt-search');
    const search = await yts(query);
    const video = search?.videos?.[0];
    if (!video) throw new Error('No YT result');
    const res = await axios.get(
        `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(video.url)}`,
        { timeout: 60000, headers: { Accept: 'application/json' } }
    );
    if (res?.data?.status && res?.data?.data?.url) {
        return {
            downloadUrl: res.data.data.url,
            title: res.data.data.title || video.title,
            thumbnail: video.thumbnail
        };
    }
    throw new Error('Siputzx returned no URL');
}

// ─── Main Command ─────────────────────────────────────────────────────────
async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: '🎵 Usage: *.song <song name>*\nExample: .song pal pal dil ke paas'
            }, { quoted: message });
        }

        // Send the first loading frame (will be edited as work progresses)
        const loadingMsg = await sock.sendMessage(chatId, {
            text: `🎵 *Searching:* ${searchQuery}\n${LOADING_FRAMES[0]}`
        }, { quoted: message });

        const editLoading = async (frameIdx, label) => {
            try {
                await sock.sendMessage(chatId, {
                    text: `🎵 *${label}*\n${LOADING_FRAMES[frameIdx]}`,
                    edit: loadingMsg.key
                });
            } catch { /* edit failures are non-fatal */ }
        };

        const apis = [
            { name: 'Anabot',  fn: () => getAnabotAudio(searchQuery) },
            { name: 'Yupra',   fn: () => getYupraAudio(searchQuery) },
            { name: 'Keith',   fn: () => getKeithAudio(searchQuery) },
            { name: 'Siputzx', fn: () => getSiputzxAudio(searchQuery) }
        ];

        // Frame 1 → Searching (already shown). Move to frame 2 while resolving APIs.
        await sleep(500);
        await editLoading(1, 'Searching APIs');

        let meta = null;

        for (const api of apis) {
            try {
                console.log(`[song] Trying ${api.name}...`);
                meta = await api.fn();
                console.log(`[song] ${api.name} success: ${meta.title}`);
                break;
            } catch (err) {
                console.log(`[song] ${api.name} failed: ${err.message}`);
            }
        }

        if (!meta?.downloadUrl) {
            try {
                await sock.sendMessage(chatId, {
                    text: '❌ Song download nahi ho saka. Koi API kaam nahi kar rahi.\nThori der baad dobara try karo.',
                    edit: loadingMsg.key
                });
            } catch {
                await sock.sendMessage(chatId, {
                    text: '❌ Song download nahi ho saka. Koi API kaam nahi kar rahi.\nThori der baad dobara try karo.'
                }, { quoted: message });
            }
            return;
        }

        // Frame 3 → Found, downloading
        await editLoading(2, `Found: ${meta.title.substring(0, 40)}`);

        const durationText = meta.duration ? `${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2, '0')}` : 'N/A';

        // Download audio buffer
        console.log(`[song] Downloading from: ${meta.downloadUrl}`);
        await editLoading(3, `Downloading • ${durationText}`);
        const dlRes = await axios.get(meta.downloadUrl, AXIOS_DL);
        const audioBuffer = Buffer.from(dlRes.data);

        if (!audioBuffer?.length) {
            try {
                await sock.sendMessage(chatId, {
                    text: '❌ Audio file download nahi hua. Dobara try karo.',
                    edit: loadingMsg.key
                });
            } catch {
                await sock.sendMessage(chatId, {
                    text: '❌ Audio file download nahi hua. Dobara try karo.'
                }, { quoted: message });
            }
            return;
        }

        // Frame 5 → Complete
        await editLoading(4, `Ready: ${meta.title.substring(0, 40)}`);

        // Send thumbnail with info
        if (meta.thumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: meta.thumbnail },
                    caption: `🎵 *${meta.title}*\n⏱ Duration: ${durationText}`
                }, { quoted: message });
            } catch (_) {}
        }

        // Detect format and convert if needed
        const sig = audioBuffer.slice(0, 12);
        const hex4 = sig.slice(0, 4).toString('hex');
        const ascii48 = sig.toString('ascii', 4, 8);
        const isM4A = ascii48 === 'ftyp' || hex4 === '00000018' || hex4 === '00000020';
        const isOgg  = sig.toString('ascii', 0, 4) === 'OggS';
        const isWav  = sig.toString('ascii', 0, 4) === 'RIFF';

        let finalBuffer = audioBuffer;
        let finalMime = 'audio/mpeg';
        let fileExt   = 'mp3';

        if (isM4A || isOgg || isWav) {
            try {
                const ext = isM4A ? 'm4a' : isOgg ? 'ogg' : 'wav';
                const converted = await toAudio(audioBuffer, ext);
                if (converted?.length) {
                    finalBuffer = converted;
                    finalMime   = 'audio/mpeg';
                    fileExt     = 'mp3';
                }
            } catch (err) {
                console.error('[song] Conversion failed:', err.message);
                finalMime = isM4A ? 'audio/mp4' : 'audio/mpeg';
                fileExt   = isM4A ? 'm4a' : 'mp3';
            }
        }

        const safeName = meta.title.replace(/[^\w\s\-]/g, '').trim().substring(0, 60);
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: finalMime,
            fileName: `${safeName}.${fileExt}`,
            ptt: false
        }, { quoted: message });

    } catch (err) {
        console.error('[song] Command error:', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Song download mein error aya. Dobara try karo.\n_' + err.message + '_'
        }, { quoted: message });
    }
}

module.exports = songCommand;
