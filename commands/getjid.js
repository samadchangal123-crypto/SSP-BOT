const settings = require('../rdx-settings');

async function getJidCommand(sock, chatId, message, args) {
    try {
        const link = args.trim();

        if (!link) {
            // No link provided — show current chat JID
            const isGroup = chatId.endsWith('@g.us');
            if (isGroup) {
                try {
                    const meta = await sock.groupMetadata(chatId);
                    await sock.sendMessage(chatId, {
                        text: `╭━━━━━━━━━━━━━━━━━╮
│   ✅ *CURRENT GROUP JID*   
╰━━━━━━━━━━━━━━━━━╯

📛 *Name:* ${meta.subject}
🆔 *JID:* \`${chatId}\`
👥 *Members:* ${meta.participants.length}

💡 Yeh JID copy karo aur *.convo on* mein paste karo.`
                    }, { quoted: message });
                } catch (_) {
                    await sock.sendMessage(chatId, {
                        text: `🆔 *Current Group JID:*\n\n\`${chatId}\``
                    }, { quoted: message });
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `╭━━━━━━━━━━━━━━━━━╮
│   📎 *GET JID COMMAND*   
╰━━━━━━━━━━━━━━━━━╯

🆔 *Aapka JID:* \`${chatId}\`

*Group JID pane ke liye:*
Group mein ja kar *.getjid* type karo

*Ya invite link se:*
\`.getjid https://chat.whatsapp.com/ABC123\``
                }, { quoted: message });
            }
            return;
        }

        // ===== WHATSAPP GROUP LINK =====
        const groupMatch = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
        if (groupMatch) {
            const inviteCode = groupMatch[1];
            await sock.sendMessage(chatId, { text: '⏳ Group info fetch ho rahi hai...' }, { quoted: message });

            try {
                const groupInfo = await sock.groupGetInviteInfo(inviteCode);
                const jid = groupInfo.id;
                const name = groupInfo.subject || 'Unknown';
                const size = groupInfo.size || '?';
                const desc = groupInfo.desc || 'No description';

                const reply = `╭━━━━━━━━━━━━━━━━━╮
│   ✅ *GROUP JID FOUND*   
╰━━━━━━━━━━━━━━━━━╯

📛 *Name:* ${name}
🆔 *JID:* \`${jid}\`
👥 *Members:* ${size}
📝 *Desc:* ${desc.slice(0, 80)}${desc.length > 80 ? '...' : ''}

╰━━━━━━━━━━━━━━━━━╯
> *${settings.botname || 'RDX BOT'}*`;

                await sock.sendMessage(chatId, { text: reply }, { quoted: message });
            } catch (err) {
                await sock.sendMessage(chatId, {
                    text: `❌ *Error:* Group info nahi mili.\n\n_Reason: ${err.message}_\n\n*Note:* Invite link valid honi chahiye aur bot us group mein hona chahiye ya link active hona chahiye.`
                }, { quoted: message });
            }
            return;
        }

        // ===== WHATSAPP CHANNEL LINK =====
        const channelMatch = link.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/);
        if (channelMatch) {
            const channelCode = channelMatch[1];
            await sock.sendMessage(chatId, { text: '⏳ Channel info fetch ho rahi hai...' }, { quoted: message });

            try {
                // Use the correct API with 'INVITE' type
                const result = await sock.newsletterMetadata('INVITE', channelCode);
                
                const jid = result.id || result.jid || result.newsletterJid;
                const name = result.name || result.title || 'Unknown';
                const desc = result.description || result.about || 'No description';
                const subscribers = result.subscribers || result.subscriberCount || result.subscribersCount || '?';
                const verified = result.verification === 'VERIFIED' || result.verified === true ? '✅ Verified' : '❌ Not Verified';

                const reply = `╭━━━━━━━━━━━━━━━━━╮
│   📢 *CHANNEL JID FOUND*   
╰━━━━━━━━━━━━━━━━━╯

📛 *Name:* ${name}
🆔 *JID:* \`${jid}\`
👥 *Subscribers:* ${subscribers}
🏅 *Status:* ${verified}
📝 *Desc:* ${desc.slice(0, 80)}${desc.length > 80 ? '...' : ''}

╰━━━━━━━━━━━━━━━━━╯
> *${settings.botname || 'RDX BOT'}*`;

                await sock.sendMessage(chatId, { text: reply }, { quoted: message });
            } catch (err) {
                await sock.sendMessage(chatId, {
                    text: `❌ *Error:* Channel info nahi mili.\n\n_Reason: ${err.message}_\n\n*Note:* Channel link valid aur public honi chahiye.`
                }, { quoted: message });
            }
            return;
        }

        // ===== INVALID LINK =====
        await sock.sendMessage(chatId, {
            text: `❌ *Invalid Link!*\n\n*Valid formats:*\n• \`https://chat.whatsapp.com/XXXX\` (Group)\n• \`https://whatsapp.com/channel/XXXX\` (Channel)`
        }, { quoted: message });

    } catch (error) {
        console.error('Error in getjid command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Error:* ${error.message}`
        }, { quoted: message });
    }
}

module.exports = getJidCommand;
