const axios = require('axios');
const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');

async function fetchFromAnabot(text) {
    const res = await axios.get(`https://anabot.my.id/api/ai/text2speech_1?text=${encodeURIComponent(text)}&apikey=freeApikey`, {
        timeout: 15000,
        headers: { 'accept': 'application/json' }
    });
    const data = res.data;
    if (!data || !data.success || !data.data?.result) return null;
    return data.data.result;
}

async function fetchBufferFromUrl(audioUrl) {
    const res = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(res.data);
}

async function ttsViaGTTS(text, language) {
    return new Promise((resolve, reject) => {
        const fileName = `tts-${Date.now()}.mp3`;
        const filePath = path.join(__dirname, '..', 'assets', fileName);
        const gtts = new gTTS(text, language);
        gtts.save(filePath, (err) => {
            if (err) return reject(err);
            resolve(filePath);
        });
    });
}

async function ttsCommand(sock, chatId, text, message, language = 'en') {
    if (!text || text.trim().length === 0) {
        return await sock.sendMessage(chatId, {
            text: '📌 Text do jo audio mein convert karna hai.\nMisal: .tts Hello good morning'
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: '🎙️', key: message.key } }).catch(() => {});

    try {
        const audioUrl = await fetchFromAnabot(text);
        if (audioUrl) {
            const audioBuffer = await fetchBufferFromUrl(audioUrl);
            await sock.sendMessage(chatId, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false
            }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }).catch(() => {});
            return;
        }
    } catch (err) {
        console.log('[TTS] Anabot failed:', err.message, '— trying gTTS fallback');
    }

    try {
        const filePath = await ttsViaGTTS(text, language);
        const audioBuffer = fs.readFileSync(filePath);
        fs.unlinkSync(filePath);
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }).catch(() => {});
    } catch (err) {
        console.error('[TTS] gTTS fallback failed:', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '❌ Audio generate nahi ho saka. Dobara try karo.'
        }, { quoted: message });
    }
}

module.exports = ttsCommand;
