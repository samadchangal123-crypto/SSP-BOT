const { fetchAsMp4Buffer } = require('../lib/gifFetcher');

const GOODBYE_GIFS = [
    'https://i.ibb.co/d4G08M8d/342059a07400.gif',
    'https://i.ibb.co/cSNz3rdk/aa6428702cc9.gif'
];

async function getRandomGoodbyeGif() {
    const shuffled = [...GOODBYE_GIFS].sort(() => Math.random() - 0.5);
    for (const url of shuffled) {
        try {
            return await fetchAsMp4Buffer(url);
        } catch (e) {
            console.log(`[goodbye] gif failed ${url}: ${e.message}`);
        }
    }
    return null;
}

const DEFAULT_GOODBYE = `✦━━━━━━━━━━━━━━━━━━━━✦
👋 *ALVIDA DOST* 👋
✦━━━━━━━━━━━━━━━━━━━━✦

👤 *Naam:* {user}
🏠 *Group:* {group}
👥 *Baaki Members:* {count}

✦━━━━━━━━━━━━━━━━━━━━✦
😢 Aap chalay gaye, yaad rahenge!
🌹 Jahan bhi rahein, khush rahein
💫 Kabhi wapis aana, hum wait karenge
✦━━━━━━━━━━━━━━━━━━━━✦
🤖 *Powered by RDX BOT*`;

async function handleLeaveEvent(sock, id, participants) {
    try {
        const groupMeta = await sock.groupMetadata(id);
        const groupName = groupMeta.subject;
        const memberCount = groupMeta.participants.length;

        for (const participant of participants) {
            try {
                const p = typeof participant === 'string' ? participant : (participant.id || participant.toString());
                const user = p.split('@')[0];

                let msg = DEFAULT_GOODBYE
                    .replace(/{user}/g, `@${user}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{count}/g, memberCount);

                // Random GIF try karo
                const gifBuffer = await getRandomGoodbyeGif();
                if (gifBuffer) {
                    try {
                        await sock.sendMessage(id, {
                            video: gifBuffer,
                            gifPlayback: true,
                            caption: msg,
                            mentions: [p],
                            mimetype: 'video/mp4'
                        });
                        continue;
                    } catch (e) {
                        console.log('[goodbye] gif send failed:', e.message);
                    }
                }

                // Fallback 1: Profile picture
                let profilePicUrl = null;
                try {
                    profilePicUrl = await sock.profilePictureUrl(p, 'image');
                } catch (_) {}

                if (profilePicUrl) {
                    try {
                        const fetch = require('node-fetch');
                        const res = await fetch(profilePicUrl);
                        if (res.ok) {
                            const imgBuffer = await res.buffer();
                            await sock.sendMessage(id, {
                                image: imgBuffer,
                                caption: msg,
                                mentions: [p]
                            });
                            continue;
                        }
                    } catch (_) {}
                }

                // Fallback 2: sirf text
                await sock.sendMessage(id, {
                    text: msg,
                    mentions: [p]
                });

            } catch (err) {
                console.error('[goodbye] participant error:', err);
                const p = typeof participant === 'string' ? participant : (participant.id || participant.toString());
                const user = p.split('@')[0];
                await sock.sendMessage(id, {
                    text: `👋 Alvida @${user}! Jahan bhi raho, khush raho! 🌹`,
                    mentions: [p]
                });
            }
        }
    } catch (e) {
        console.error('[goodbye] handleLeaveEvent error:', e);
    }
}

// Dummy command (backward compatibility ke liye)
async function goodbyeCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text: '✅ *Auto Goodbye* hamesha ON hai!\nJab bhi koi group chore ga, bot khud ba khud goodbye kare ga. Koi command ki zaroorat nahi! 👋',
        quoted: message
    });
}

module.exports = { goodbyeCommand, handleLeaveEvent, DEFAULT_GOODBYE };
