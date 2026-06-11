const { channelInfo } = require('../lib/messageConfig');
const settings = require('../rdx-settings');
const { fetchAsMp4Buffer } = require('../lib/gifFetcher');

const JOIN_GIF_URL = 'https://i.ibb.co/dJ28RRFy/bb1ffa43d4a3.gif';

async function handleBotJoinedGroup(sock, update) {
    try {
        const { id, participants, action } = update;

        if (!id.endsWith('@g.us')) return;
        if (action !== 'add') return;

        // Get bot's raw JID e.g. "923301068874:84@s.whatsapp.net"
        const botRaw = sock.user?.id || '';

        // Extract pure phone number digits only
        const botNumber = botRaw.split(':')[0].split('@')[0].replace(/\D/g, '');

        console.log(`[JoinNotify] Bot number: ${botNumber}, participants: ${JSON.stringify(participants)}`);

        if (!botNumber) {
            console.log('[JoinNotify] Could not determine bot number');
            return;
        }

        // Check all participants — handle @s.whatsapp.net, @lid, plain string
        const isBotAdded = participants.some(p => {
            const raw = typeof p === 'string' ? p : (p?.id || p?.jid || '');
            // Strip everything after : and @, keep only digits
            const pNumber = raw.split(':')[0].split('@')[0].replace(/\D/g, '');
            console.log(`[JoinNotify] Participant raw: ${raw}, number: ${pNumber}`);
            return pNumber === botNumber;
        });

        console.log(`[JoinNotify] isBotAdded: ${isBotAdded}`);

        if (!isBotAdded) {
            // Fallback: if only 1 participant and it looks like the bot was self-added
            console.log('[JoinNotify] Bot not detected in participants, skipping.');
            return;
        }

        console.log(`[JoinNotify] ✅ Bot added to group: ${id}`);

        // Fetch group info
        let groupName = 'Group';
        let memberCount = 0;
        try {
            const meta = await sock.groupMetadata(id);
            groupName = meta.subject || 'Group';
            memberCount = meta.participants.length;
        } catch (e) {
            console.log('[JoinNotify] metadata error:', e.message);
        }

        const botName = settings.botName || 'RDX BOT';
        const prefix = settings.prefix || '.';
        const ownerNum = Array.isArray(settings.ownerNumber)
            ? settings.ownerNumber[0]
            : settings.ownerNumber || '';

        const msg = `╭━━━━━━━━━━━━━━━━━━━━╮
┃  ✅ *BOT CONNECTED!*
╰━━━━━━━━━━━━━━━━━━━━╯

👋 Assalam o Alaikum!
Main hoon *${botName}* — aapka group assistant! 🤖

🏠 *Group:* ${groupName}
👥 *Members:* ${memberCount}
👑 *Owner:* @${ownerNum}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📋 *QUICK COMMANDS*
╰━━━━━━━━━━━━━━━━━━━━╯

• *${prefix}menu* — Sari commands dekhein
• *${prefix}help* — Help guide
• *${prefix}info* — Bot ki info
• *${prefix}ping* — Bot check karein

╭━━━━━━━━━━━━━━━━━━━━╮
┃ ⚡ *AUTO FEATURES*
╰━━━━━━━━━━━━━━━━━━━━╯

✅ Auto Welcome — ON
✅ Auto Goodbye — ON
✅ Antilink Protection — Available
✅ Bad Word Filter — Available

*Bot add karne ka shukriya!* 🎉
🤖 *Powered by RDX BOT*`;

        const mentions = ownerNum ? [`${ownerNum}@s.whatsapp.net`] : [];

        // Try to send with GIF, fallback to text-only on failure
        let sentWithGif = false;
        try {
            const gifBuffer = await fetchAsMp4Buffer(JOIN_GIF_URL);
            await sock.sendMessage(id, {
                video: gifBuffer,
                gifPlayback: true,
                caption: msg,
                mentions,
                mimetype: 'video/mp4',
                ...channelInfo
            });
            sentWithGif = true;
        } catch (gifErr) {
            console.log('[JoinNotify] GIF send failed, sending text only:', gifErr.message);
        }

        if (!sentWithGif) {
            await sock.sendMessage(id, {
                text: msg,
                mentions,
                ...channelInfo
            });
        }

        console.log('[JoinNotify] ✅ Connected message sent!');

    } catch (e) {
        console.error('[JoinNotify] Error:', e.message);
    }
}

module.exports = { handleBotJoinedGroup };
