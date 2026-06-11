const axios = require('axios');

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

async function pollinationsLogo(promptText, seed) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}` +
        `?model=flux&nologo=true&width=1024&height=1024&seed=${seed}&enhance=true&private=true`;
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

async function logoCommand(sock, chatId, message, args) {
    try {
        const userPrompt = (args && args.length > 0) ? args.join(' ').trim() : '';

        if (!userPrompt) {
            return await sock.sendMessage(chatId, {
                text: `╭━━━〔 *🎨 LOGO MAKER AI* 〕━━━╮
┃
┃ ❌ *Logo ka description likho!*
┃
┃ 📌 *Tariqa-e-Istimal:*
┃ • *.logo cat playing football*
┃ • *.logo modern tech company*
┃ • *.logo pizza shop neon style*
┃
┃ ✨ *AI aapki marzi ka logo*
┃ ✨ *bana ke deta hai!*
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🎨', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: `⏳ *Logo bana raha hoon...*\n\n🎨 *Prompt:* ${userPrompt}\n⌛ Thoda intezaar karo (30-90 sec).`,
            ...channelInfo
        }, { quoted: message });

        const styleVariants = [
            `professional logo design, ${userPrompt}, vector art, clean lines, vibrant colors, centered, white background, high quality, 4k`,
            `minimalist modern logo, ${userPrompt}, flat design, bold colors, iconic, simple, brand identity, white background`,
            `creative logo, ${userPrompt}, premium design, elegant typography, sharp details, branding, white background`
        ];

        let resultBuffer = null;
        let attemptUsed = 0;

        for (let i = 0; i < styleVariants.length; i++) {
            try {
                console.log(`[Logo] Pollinations attempt ${i + 1}...`);
                const seed = Math.floor(Math.random() * 1000000);
                const buf = await pollinationsLogo(styleVariants[i], seed);
                if (buf && buf.length > 2000) {
                    resultBuffer = buf;
                    attemptUsed = i + 1;
                    console.log(`[Logo] ✅ Success on attempt ${attemptUsed} (${buf.length}B)`);
                    break;
                }
            } catch (err) {
                console.log(`[Logo] Attempt ${i + 1} failed:`, err.message);
            }
        }

        if (!resultBuffer) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
            return await sock.sendMessage(chatId, {
                text: `╭━━━〔 *⚠ LOGO FAILED* 〕━━━╮
┃
┃ ❌ Logo nahi ban saka!
┃
┃ 🔁 Wajhaat:
┃ • AI server bohat busy hai
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
            caption: `╭━━━〔 *✨ LOGO READY* 〕━━━╮
┃
┃ ✅ *Status:* Ban gaya!
┃ 🎨 *Prompt:* ${userPrompt}
┃ 🚀 *Engine:* Pollinations Flux
┃ 🔢 *Attempt:* ${attemptUsed}
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
            ...channelInfo
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }).catch(() => {});

    } catch (err) {
        console.error('[Logo] Error:', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '❌ Logo banane mein error aayi. Dobara try karo.',
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = logoCommand;
