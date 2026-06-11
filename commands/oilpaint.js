const fetch = require('node-fetch');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');

async function uploadToTmpfiles(buffer, filename = 'image.jpg') {
    try {
        const form = new FormData();
        form.append('file', buffer, { filename });
        const res = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        const json = await res.json();
        if (json?.data?.url) {
            return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        }
        return null;
    } catch (e) {
        console.error('tmpfiles upload failed:', e.message);
        return null;
    }
}

async function oilPaintCommand(sock, chatId, msg) {
    try {
        const text = msg.message?.conversation?.trim() ||
                     msg.message?.extendedTextMessage?.text?.trim() || '';
        const args = text.split(' ').slice(1);

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedImage = quoted?.imageMessage;
        const directImage = msg.message?.imageMessage;

        let imageUrl = null;

        if (args[0] && /^https?:\/\//i.test(args[0])) {
            imageUrl = args[0];
        } else if (quotedImage || directImage) {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            const targetMsg = quotedImage
                ? { message: { imageMessage: quotedImage } }
                : msg;

            const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {});
            imageUrl = await uploadToTmpfiles(buffer, `oil_${Date.now()}.jpg`);

            if (!imageUrl) {
                await sock.sendMessage(chatId, {
                    text: '❌ Image upload fail ho gayi. Dobara try karein.'
                }, { quoted: msg });
                return;
            }
        } else {
            await sock.sendMessage(chatId, {
                text: '🎨 *Oil Painting*\n\n📌 Use:\n• Reply to an image: *.oil*\n• Or pass a direct image URL: *.oil https://example.com/image.jpg*\n\nConverts the image into an oil painting style.'
            }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        const apiResponse = await fetch('https://anabot.my.id/api/ai/toOil_painting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl, apikey: 'freeApikey' })
        });

        let data = null;
        try { data = await apiResponse.json(); } catch (_) { data = null; }

        if (!apiResponse.ok || !data?.success) {
            const errMsg = (typeof data?.error === 'string')
                ? data.error
                : (data?.error?.message || `HTTP ${apiResponse.status}`);
            await sock.sendMessage(chatId, {
                text: `❌ Oil painting API is currently down.\n\nReason: ${errMsg}\n\nThis is an issue on the API server (anabot.my.id), not your bot. Please try again later — the command will work as soon as their service is restored.`
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return;
        }

        const resultUrl = data?.data?.result || data?.result;

        if (!resultUrl || !String(resultUrl).startsWith('http')) {
            await sock.sendMessage(chatId, {
                text: '❌ API ne valid image return nahi ki. Dobara try karein.'
            }, { quoted: msg });
            return;
        }

        const imgRes = await fetch(resultUrl);
        if (!imgRes.ok) throw new Error('Failed to download result image');
        const imgBuffer = await imgRes.buffer();

        await sock.sendMessage(chatId, {
            image: imgBuffer,
            caption: '🎨 Here is your oil painting'
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        console.error('Error in oilpaint command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to make the oil painting. Please try again later.'
        }, { quoted: msg });
    }
}

module.exports = oilPaintCommand;
