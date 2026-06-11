const { getRandomGif } = require('../lib/gifFetcher');

const kissVideos = [
    'https://i.ibb.co/HLhHSRft/844081463055.gif',
    'https://i.ibb.co/9HM9LSH0/c95b642bf3ce.gif',
    'https://i.ibb.co/GQhMBtgW/09d02ec1453a.gif',
    'https://d.uguu.se/EQMzSnEK.mp4',
    'https://d.uguu.se/FhyOgYOy.mp4',
    'https://h.uguu.se/uRYsJVXP.mp4',
];

const kissCaptions = [
    `💋 *KISS ATTACK!* 💋\n\n😘 @VICTIM ko pyaar bhari kiss!\n\n❤️ Itna pyaar sambhal ke rakhna!`,
    `💞 *SWEET KISS!* 💞\n\n🥰 @VICTIM beshak special hai!\n\n😍 Yeh kiss yaadgaar rahegi!`,
    `❤️ *LOVE KISS!* ❤️\n\n💖 @VICTIM ke liye dil se kiss!\n\n🌹 Pyaar hi pyaar hai!`,
    `😘 *MUAH!* 😘\n\n💝 @VICTIM ko meethi si kiss!\n\n💕 Dil khush ho gaya!`
];

async function getKissVideo() {
    return await getRandomGif(kissVideos, [
        'https://nekos.best/api/v2/kiss',
        'https://api.waifu.pics/sfw/kiss'
    ]);
}

async function kissCommand(sock, chatId, message) {
    try {
        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

        let victimID = null;
        if (quotedParticipant) victimID = quotedParticipant;
        else if (mentionedJid.length > 0) victimID = mentionedJid[0];

        if (!victimID) {
            return await sock.sendMessage(chatId, {
                text: `💋 *Kiss Command*\n\n*Use karo:*\n.kiss @username\n\nYa kisi ke message pe reply karke .kiss likho!`
            }, { quoted: message });
        }

        const senderId = message.key.participant || message.key.remoteJid;
        if (victimID === senderId) {
            return await sock.sendMessage(chatId, {
                text: '❌ Apne aap ko kiss nahi kar sakte! 😂'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '💋', key: message.key } });

        const { buffer } = await getKissVideo();
        const randomCaption = kissCaptions[Math.floor(Math.random() * kissCaptions.length)]
            .replace(/@VICTIM/g, `@${victimID.split('@')[0]}`);

        await sock.sendMessage(chatId, {
            video: buffer,
            gifPlayback: true,
            caption: randomCaption,
            mentions: [victimID],
            mimetype: 'video/mp4'
        }, { quoted: message });

    } catch (err) {
        console.error('[Kiss] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Kiss nahi maar saka! Dobara try karo. 😅'
        }, { quoted: message });
    }
}

module.exports = kissCommand;
