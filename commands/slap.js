const { getRandomGif } = require('../lib/gifFetcher');

const slapVideos = [
    'https://i.ibb.co/5hWpKFtG/a9d30827f71c.gif',
    'https://i.ibb.co/3m4M1fzZ/d9e88aeaa785.gif',
    'https://i.ibb.co/k2RC9zGG/24c26737de85.gif',
    'https://i.ibb.co/VcqSFj0m/c76cc49d8c91.gif',
    'https://h.uguu.se/lXtaCrHU.mp4',
    'https://d.uguu.se/uRkHWhFm.mp4',
    'https://h.uguu.se/FskPpahG.mp4',
    'https://d.uguu.se/piGwamAZ.mp4',
];

const slapCaptions = [
    `💥 *SLAP ATTACK!* 💥\n\n👋 Yaar ne thappar maar diya @VICTIM ko!\n\n😤 Agli baar adab se aaana!`,
    `👋 *THAPAR MAAR DIYA!* 👋\n\n😵 @VICTIM bechara!\n\n🤣 Yeh thappar yaad rahega!`,
    `💢 *SLAP OF JUSTICE!* 💢\n\n🔥 @VICTIM ko sabaq mil gaya!\n\n😂 Ab theek se rehna!`,
    `🤜 *MEGA SLAP!* 🤛\n\n😂 @VICTIM ko thappar raseed!\n\n👊 RDX BOT se panga mat lo!`
];

async function getSlapVideo() {
    return await getRandomGif(slapVideos, [
        'https://nekos.best/api/v2/slap',
        'https://api.waifu.pics/sfw/slap'
    ]);
}

async function slapCommand(sock, chatId, message) {
    try {
        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

        let victimID = null;
        if (quotedParticipant) victimID = quotedParticipant;
        else if (mentionedJid.length > 0) victimID = mentionedJid[0];

        if (!victimID) {
            return await sock.sendMessage(chatId, {
                text: `👋 *Slap Command*\n\n*Use karo:*\n.slap @username\n\nYa kisi ke message pe reply karke .slap likho!`
            }, { quoted: message });
        }

        const senderId = message.key.participant || message.key.remoteJid;
        if (victimID === senderId) {
            return await sock.sendMessage(chatId, {
                text: '❌ Apne aap ko thappar nahi maar sakte bhai! 😂'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '👋', key: message.key } });

        const { buffer } = await getSlapVideo();
        const randomCaption = slapCaptions[Math.floor(Math.random() * slapCaptions.length)]
            .replace(/@VICTIM/g, `@${victimID.split('@')[0]}`);

        await sock.sendMessage(chatId, {
            video: buffer,
            gifPlayback: true,
            caption: randomCaption,
            mentions: [victimID],
            mimetype: 'video/mp4'
        }, { quoted: message });

    } catch (err) {
        console.error('[Slap] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Slap nahi maar saka! Dobara try karo. 😅'
        }, { quoted: message });
    }
}

module.exports = slapCommand;
