const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');

const channelInfo = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363407914650384@newsletter',
            newsletterName: 'RDX BOT',
            serverMessageId: -1
        }
    }
};

function isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
}

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function getImageUrl(sock, message, args) {
    if (args && args.length > 0) {
        const url = args.join(' ').trim();
        if (isValidUrl(url)) return { url };
    }

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const buffer = await streamToBuffer(stream);
        const url = await uploadImage(buffer);
        return { url };
    }

    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const buffer = await streamToBuffer(stream);
        const url = await uploadImage(buffer);
        return { url };
    }

    return null;
}

// Pollinations.ai - Free, reliable, image-to-image with flux model
async function pollinationsAnime(imageUrl, promptText, seed) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}` +
        `?model=flux&image=${encodeURIComponent(imageUrl)}` +
        `&nologo=true&width=768&height=768&seed=${seed}&enhance=true&private=true`;
    const res = await axios.get(url, {
        timeout: 120000,
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const ct = res.headers['content-type'] || '';
    if (!ct.startsWith('image/')) return null;
    if (!res.data || res.data.byteLength < 2000) return null;
    return Buffer.from(res.data);
}

async function toAnimeCommand(sock, chatId, message, args) {
    try {
        const imgData = await getImageUrl(sock, message, args);

        if (!imgData || !imgData.url) {
            return await sock.sendMessage(chatId, {
                text: `╭━━━〔 *🎨 TO-ANIME AI* 〕━━━╮
┃
┃ ❌ *Koi image nahi mili!*
┃
┃ 📌 *Tariqa-e-Istimal:*
┃ • Image bhejo aur caption *.toanime*
┃ • Image par reply karo *.toanime*
┃ • *.toanime <image url>*
┃
┃ ✨ *Aapki photo ko anime style*
┃ ✨ *mein convert kar deta hai!*
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🎨', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '⏳ *Anime mein convert ho rahi hai...*\n\n🎨 AI processing chal rahi hai, thoda intezaar karo (30-90 sec).',
            ...channelInfo
        }, { quoted: message });

        const prompts = [
            'anime style portrait, ghibli studio, detailed face, vibrant colors, anime illustration, high quality',
            'beautiful anime art style, manga illustration, detailed anime face, sharp lines, cel-shaded',
            'anime aesthetic, japanese animation style, detailed character, soft lighting, masterpiece'
        ];

        let resultBuffer = null;
        let attemptUsed = 0;

        for (let i = 0; i < prompts.length; i++) {
            try {
                console.log(`[ToAnime] Pollinations attempt ${i + 1}...`);
                const seed = Math.floor(Math.random() * 1000000);
                const buf = await pollinationsAnime(imgData.url, prompts[i], seed);
                if (buf && buf.length > 2000) {
                    resultBuffer = buf;
                    attemptUsed = i + 1;
                    console.log(`[ToAnime] ✅ Success on attempt ${attemptUsed} (${buf.length}B)`);
                    break;
                }
            } catch (err) {
                console.log(`[ToAnime] Attempt ${i + 1} failed:`, err.message);
            }
        }

        if (!resultBuffer) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
            return await sock.sendMessage(chatId, {
                text: `╭━━━〔 *⚠ CONVERSION FAILED* 〕━━━╮
┃
┃ ❌ Image anime mein convert nahi ho saki!
┃
┃ 🔁 Wajhaat:
┃ • AI server bohat busy hai
┃ • Image format support nahi
┃ • Network issue ho sakta hai
┃
┃ 💡 Thodi der baad dobara try karo.
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            image: resultBuffer,
            caption: `╭━━━〔 *✨ ANIME MAGIC* 〕━━━╮
┃
┃ ✅ *Status:* Converted!
┃ 🎨 *Style:* Anime AI
┃ 🚀 *Engine:* Pollinations Flux
┃ 🔢 *Attempt:* ${attemptUsed}
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
            ...channelInfo
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }).catch(() => {});

    } catch (err) {
        console.error('[ToAnime] Error:', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '❌ Anime convert karne mein error aayi. Dobara try karo.',
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = toAnimeCommand;
