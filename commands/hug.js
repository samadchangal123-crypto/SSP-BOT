const { getRandomGif } = require('../lib/gifFetcher');

const hugVideos = [
    'https://i.ibb.co/j92VmDTF/e742efd821cf.gif',
    'https://i.ibb.co/svmYLcM9/cc8181801961.gif',
    'https://i.ibb.co/8n2CXT4y/2d89179d3b9c.gif',
    'https://i.ibb.co/xqnG5mFT/16b899ce7260.gif',
    'https://o.uguu.se/igVYwPqT.mp4',
    'https://h.uguu.se/hZYOkjlg.mp4',
    'https://n.uguu.se/wVFGmAMh.mp4',
    'https://n.uguu.se/bkBvVdYy.mp4',
    'https://d.uguu.se/vyzAGGcm.mp4',
];

const hugCaptions = [
    `🤗 *HUG ATTACK!* 🤗\n\n@VICTIM ko pyaari si hug!\n\n❤️ Aaj ka din khush ho tumhara!`,
    `💞 *WARM HUG!* 💞\n\n🥰 @VICTIM ke liye garam jaadu ki jhappi!\n\n😊 Sab theek ho jayega!`,
    `🫂 *BEAR HUG!* 🫂\n\n😄 @VICTIM beshak special hai!\n\n🌟 Yeh hug yaad rakhna!`,
    `💝 *SUPER HUG!* 💝\n\n🤗 @VICTIM ke liye dil se hug!\n\n💫 Khush raho hamesha!`
];

async function getHugVideo() {
    return await getRandomGif(hugVideos, [
        'https://nekos.best/api/v2/hug',
        'https://api.waifu.pics/sfw/hug'
    ]);
}

async function hugCommand(sock, chatId, message) {
    try {
        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

        let victimID = null;
        if (quotedParticipant) victimID = quotedParticipant;
        else if (mentionedJid.length > 0) victimID = mentionedJid[0];

        if (!victimID) {
            return await sock.sendMessage(chatId, {
                text: `🤗 *Hug Command*\n\n*Use karo:*\n.hug @username\n\nYa kisi ke message pe reply karke .hug likho!`
            }, { quoted: message });
        }

        const senderId = message.key.participant || message.key.remoteJid;
        if (victimID === senderId) {
            return await sock.sendMessage(chatId, {
                text: '🤗 Apne aap ko hug karna bhi acha hai! Par kisi aur ko tag karo! 😄'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🤗', key: message.key } });

        const { buffer } = await getHugVideo();
        const randomCaption = hugCaptions[Math.floor(Math.random() * hugCaptions.length)]
            .replace(/@VICTIM/g, `@${victimID.split('@')[0]}`);

        await sock.sendMessage(chatId, {
            video: buffer,
            gifPlayback: true,
            caption: randomCaption,
            mentions: [victimID],
            mimetype: 'video/mp4'
        }, { quoted: message });

    } catch (err) {
        console.error('[Hug] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Hug nahi maar saka! Dobara try karo. 😅'
        }, { quoted: message });
    }
}

module.exports = hugCommand;
