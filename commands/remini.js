const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');

function isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
}

async function getImageUrl(sock, message, args) {
    if (args && args.length > 0) {
        const url = args.join(' ').trim();
        if (isValidUrl(url)) return { url, buffer: null };
    }

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const url = await uploadImage(buffer);
        return { url, buffer };
    }

    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const url = await uploadImage(buffer);
        return { url, buffer };
    }

    return null;
}

async function enhanceViaAnabot(imageUrl) {
    const res = await axios.get(`https://anabot.my.id/api/ai/remini?imageUrl=${encodeURIComponent(imageUrl)}&apikey=freeApikey`, {
        timeout: 60000,
        headers: { 'accept': 'application/json' }
    });
    if (!res.data?.success || !res.data?.data?.result) return null;
    return res.data.data.result;
}

async function enhanceViaRyzen(imageUrl) {
    const res = await axios.get(`https://api.ryzendesu.xyz/api/ai/remini?url=${encodeURIComponent(imageUrl)}`, {
        timeout: 60000,
        headers: { 'accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.data?.status || !res.data?.data) return null;
    return res.data.data;
}

async function enhanceViaSiputzx(imageUrl) {
    const res = await axios.get(`https://api.siputzx.my.id/api/ai/remini?url=${encodeURIComponent(imageUrl)}`, {
        timeout: 60000,
        headers: { 'accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.data?.status || !res.data?.data) return null;
    return res.data.data;
}

async function enhanceViaPrince(imageUrl) {
    const res = await axios.get(`https://api.princetechn.com/api/tools/remini?apikey=prince_tech_api_azfsbshfb&url=${encodeURIComponent(imageUrl)}`, {
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.data?.success || !res.data?.result?.image_url) return null;
    return res.data.result.image_url;
}

async function reminiCommand(sock, chatId, message, args) {
    try {
        const imgData = await getImageUrl(sock, message, args);

        if (!imgData || !imgData.url) {
            return await sock.sendMessage(chatId, {
                text: `📸 *Remini AI Image Enhancer*\n\n*Use karo:*\n• Image bhejo aur reply karo *.remini*\n• *.remini <image url>*\n\nMisal: .remini https://example.com/photo.jpg`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '✨', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '⏳ Image enhance ho rahi hai... AI processing chal rahi hai, thoda wait karo.'
        }, { quoted: message });

        const apiFns = [enhanceViaAnabot, enhanceViaRyzen, enhanceViaSiputzx, enhanceViaPrince];
        let enhancedUrl = null;

        for (const fn of apiFns) {
            try {
                enhancedUrl = await fn(imgData.url);
                if (enhancedUrl) {
                    console.log(`[Remini] Success via ${fn.name}`);
                    break;
                }
            } catch (err) {
                console.log(`[Remini] ${fn.name} failed:`, err.message);
            }
        }

        if (!enhancedUrl) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
            return await sock.sendMessage(chatId, {
                text: '❌ Image enhance nahi ho saki. Koi doosri image try karo.'
            }, { quoted: message });
        }

        const imgRes = await axios.get(enhancedUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        await sock.sendMessage(chatId, {
            image: Buffer.from(imgRes.data),
            caption: '✨ *Image Enhanced by RDX BOT* 🤖\n_Powered by Remini AI_'
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }).catch(() => {});

    } catch (err) {
        console.error('[Remini] Error:', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '❌ Image enhance karne mein error aayi. Dobara try karo.'
        }, { quoted: message });
    }
}

module.exports = { reminiCommand };
