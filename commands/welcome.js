const { channelInfo } = require('../lib/messageConfig');
const { fetchAsMp4Buffer } = require('../lib/gifFetcher');

const WELCOME_GIFS = [
    'https://i.ibb.co/WWRt2Vsy/2b3439f71d76.gif',
    'https://i.ibb.co/nNK2TX75/dc82e95aba67.gif',
    'https://i.ibb.co/tMK00Qct/a008ff0dca24.gif'
];

async function getRandomWelcomeGif() {
    const shuffled = [...WELCOME_GIFS].sort(() => Math.random() - 0.5);
    for (const url of shuffled) {
        try {
            return await fetchAsMp4Buffer(url);
        } catch (e) {
            console.log(`[welcome] gif failed ${url}: ${e.message}`);
        }
    }
    return null;
}

const DEFAULT_WELCOME = `✦━━━━━━━━━━━━━━━━━━━━✦
🌟 *KHUSH AAMDEED* 🌟
✦━━━━━━━━━━━━━━━━━━━━✦

👤 *Naam:* {user}
🏠 *Group:* {group}
👥 *Members:* {count}

✦━━━━━━━━━━━━━━━━━━━━✦
🎉 Aapka is group mein dil se swagat hai!
📜 Group rules zaroor parhen
🤝 Sab ke saath achi tarah pesh aayen
🚫 Spam aur bad language se bachen
✦━━━━━━━━━━━━━━━━━━━━✦
🤖 *Powered by RDX BOT*`;

async function handleJoinEvent(sock, id, participants) {
    try {
        const groupMeta = await sock.groupMetadata(id);
        const memberCount = groupMeta.participants.length;

        for (const participant of participants) {
            const p = typeof participant === 'string' ? participant : participant.id;
            const user = p.split('@')[0];

            let msg = DEFAULT_WELCOME
                .replace(/{user}/g, `@${user}`)
                .replace(/{group}/g, groupMeta.subject)
                .replace(/{count}/g, memberCount);

            // Random GIF try karo
            const gifBuffer = await getRandomWelcomeGif();
            if (gifBuffer) {
                try {
                    await sock.sendMessage(id, {
                        video: gifBuffer,
                        gifPlayback: true,
                        caption: msg,
                        mentions: [p],
                        mimetype: 'video/mp4',
                        ...channelInfo
                    });
                    continue;
                } catch (e) {
                    console.log('[welcome] gif send failed:', e.message);
                }
            }

            // Fallback 1: Profile picture
            let profilePicUrl = null;
            try {
                profilePicUrl = await sock.profilePictureUrl(p, 'image');
            } catch (_) {}

            if (profilePicUrl) {
                try {
                    const { default: fetch } = require('node-fetch');
                    const res = await fetch(profilePicUrl);
                    if (res.ok) {
                        const imgBuffer = await res.buffer();
                        await sock.sendMessage(id, {
                            image: imgBuffer,
                            caption: msg,
                            mentions: [p],
                            ...channelInfo
                        });
                        continue;
                    }
                } catch (_) {}
            }

            // Fallback 2: sirf text
            await sock.sendMessage(id, {
                text: msg,
                mentions: [p],
                ...channelInfo
            });
        }
    } catch (e) {
        console.error('[welcome] handleJoinEvent error:', e);
    }
}

// Dummy command (backward compatibility ke liye)
async function welcomeCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text: '✅ *Auto Welcome* hamesha ON hai!\nJab bhi koi group join kare ga, bot khud ba khud welcome kare ga. Koi command ki zaroorat nahi! 🎉',
        quoted: message
    });
}

module.exports = { welcomeCommand, handleJoinEvent, DEFAULT_WELCOME };
