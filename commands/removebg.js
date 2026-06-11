const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');

function isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
}

async function getImageUrl(sock, message, args) {
    if (args && args.length > 0) {
        const url = args.join(' ').trim();
        if (isValidUrl(url)) return url;
    }

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return await uploadImage(Buffer.concat(chunks));
    }

    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return await uploadImage(Buffer.concat(chunks));
    }

    return null;
}

async function removeViaAnabot(imageUrl) {
    const res = await axios.get(`https://anabot.my.id/api/ai/removebg?imageUrl=${encodeURIComponent(imageUrl)}&apikey=freeApikey`, {
        timeout: 40000,
        headers: { 'accept': 'application/json' }
    });
    if (!res.data?.success || !res.data?.data?.result) return null;
    const imgRes = await axios.get(res.data.data.result, { responseType: 'arraybuffer', timeout: 20000 });
    return Buffer.from(imgRes.data);
}

async function removeViaRyzen(imageUrl) {
    const res = await axios.get(`https://api.ryzendesu.xyz/api/ai/removebg?url=${encodeURIComponent(imageUrl)}`, {
        responseType: 'arraybuffer',
        timeout: 40000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.data || res.data.length < 100) return null;
    return Buffer.from(res.data);
}

async function removeViaRemovebgAlt(imageUrl) {
    const res = await axios.get(`https://api.siputzx.my.id/api/ai/removebg?url=${encodeURIComponent(imageUrl)}`, {
        responseType: 'arraybuffer',
        timeout: 40000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.data || res.data.length < 100) return null;
    return Buffer.from(res.data);
}

module.exports = {
    name: 'removebg',
    alias: ['rmbg', 'nobg'],
    category: 'general',
    desc: 'Remove background from images using AI',

    async exec(sock, message, args) {
        const chatId = message.key.remoteJid;
        try {
            const imageUrl = await getImageUrl(sock, message, args);

            if (!imageUrl) {
                return await sock.sendMessage(chatId, {
                    text: `🖼️ *Remove Background AI*\n\n*Use karo:*\n• Image bhejo aur reply karo *.removebg*\n• *.removebg <image url>*\n\nMisal: .removebg https://example.com/image.jpg`
                }, { quoted: message });
            }

            await sock.sendMessage(chatId, { react: { text: '🎨', key: message.key } }).catch(() => {});
            await sock.sendMessage(chatId, {
                text: '⏳ Background remove ho raha hai... AI processing chal rahi hai.'
            }, { quoted: message });

            const apiFns = [removeViaAnabot, removeViaRyzen, removeViaRemovebgAlt];
            let resultBuffer = null;

            for (const fn of apiFns) {
                try {
                    resultBuffer = await fn(imageUrl);
                    if (resultBuffer && resultBuffer.length > 100) {
                        console.log(`[RemoveBG] Success via ${fn.name}`);
                        break;
                    }
                } catch (err) {
                    console.log(`[RemoveBG] ${fn.name} failed:`, err.message);
                }
            }

            if (!resultBuffer) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
                return await sock.sendMessage(chatId, {
                    text: '❌ Background remove nahi ho saka. Koi doosri clear image try karo.'
                }, { quoted: message });
            }

            await sock.sendMessage(chatId, {
                image: resultBuffer,
                caption: '✅ *Background Removed by RDX BOT* 🤖\n_Powered by AI_'
            }, { quoted: message });

            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }).catch(() => {});

        } catch (err) {
            console.error('[RemoveBG] Error:', err.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
            await sock.sendMessage(chatId, {
                text: '❌ Background remove karne mein error aayi. Dobara try karo.'
            }, { quoted: message });
        }
    }
};
