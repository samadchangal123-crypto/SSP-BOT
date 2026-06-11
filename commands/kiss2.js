const axios = require('axios');

const kissVideos = [
    'https://d.uguu.se/EQMzSnEK.mp4',
    'https://d.uguu.se/FhyOgYOy.mp4',
    'https://h.uguu.se/uRYsJVXP.mp4',
];

async function getKissVideo() {
    const shuffled = [...kissVideos].sort(() => Math.random() - 0.5);
    for (const url of shuffled) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (res.data && res.data.byteLength > 1000) {
                return Buffer.from(res.data);
            }
        } catch (e) {}
    }
    // Fallback: nekos.best API
    try {
        const apiRes = await axios.get('https://nekos.best/api/v2/kiss', { timeout: 10000 });
        const gifRes = await axios.get(apiRes.data.results[0].url, { responseType: 'arraybuffer', timeout: 20000 });
        return Buffer.from(gifRes.data);
    } catch (e) {
        const apiRes = await axios.get('https://api.waifu.pics/sfw/kiss', { timeout: 10000 });
        const gifRes = await axios.get(apiRes.data.url, { responseType: 'arraybuffer', timeout: 20000 });
        return Buffer.from(gifRes.data);
    }
}

async function kiss2Command(sock, chatId, message) {
    try {
        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

        let victimID = null;
        if (quotedParticipant) victimID = quotedParticipant;
        else if (mentionedJid.length > 0) victimID = mentionedJid[0];

        if (!victimID) {
            return await sock.sendMessage(chatId, {
                text: `💋 *Kiss2 Command*\n\n*Use karo:*\n.kiss2 @username`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '💋', key: message.key } });

        const buffer = await getKissVideo();

        await sock.sendMessage(chatId, {
            video: buffer,
            gifPlayback: true,
            caption: `💋 *Sweet Kiss!*\n\n@${victimID.split('@')[0]} ko meethi si kiss! 😘`,
            mentions: [victimID],
            mimetype: 'video/mp4'
        }, { quoted: message });

    } catch (err) {
        console.error('[Kiss2] Error:', err.message);
        await sock.sendMessage(chatId, { text: '❌ Error. Dobara try karo.' }, { quoted: message });
    }
}

module.exports = kiss2Command;
