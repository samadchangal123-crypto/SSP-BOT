const { isJidGroup } = require('@whiskeysockets/baileys');
const { getAntilink, incrementWarningCount, resetWarningCount, isSudo } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const config = require('../rdx-config');

const WARN_COUNT = config.WARN_COUNT || 3;

/**
 * Checks if a string contains a URL.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} - True if the string contains a URL, otherwise false.
 */
function containsURL(str) {
        const urlRegex = /(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?/i;
        const result = urlRegex.test(str);
        console.log(`[Antilink] containsURL check for "${str.substring(0, 50)}": ${result}`);
        return result;
}

/**
 * Handles the Antilink functionality for group chats.
 *
 * @param {object} msg - The message object to process.
 * @param {object} sock - The socket object to use for sending messages.
 */
async function Antilink(msg, sock) {
        const jid = msg.key.remoteJid;
        console.log(`[Antilink] Processing message from jid: ${jid}`);
        
        if (!isJidGroup(jid)) {
                console.log('[Antilink] Not a group, skipping');
                return;
        }

        const SenderMessage = msg.message?.conversation || 
                                                 msg.message?.extendedTextMessage?.text || '';
        console.log(`[Antilink] SenderMessage: "${SenderMessage.substring(0, 50)}"`);
                                                 
        if (!SenderMessage || typeof SenderMessage !== 'string') return;

        const sender = msg.key.participant;
        console.log(`[Antilink] Sender: ${sender}`);
        if (!sender) {
                console.log('[Antilink] No sender found');
                return;
        }
        
        // Skip if sender is group admin or sudo
        try {
                const { isSenderAdmin } = await isAdmin(sock, jid, sender);
                if (isSenderAdmin) return;
        } catch (_) {}
        const senderIsSudo = await isSudo(sender);
        if (senderIsSudo) return;

        if (!containsURL(SenderMessage.trim())) {
                console.log('[Antilink] No URL detected in message');
                return;
        }
        
        const antilinkConfig = await getAntilink(jid, 'on');
        console.log(`[Antilink] getAntilink result for ${jid}:`, antilinkConfig);
        if (!antilinkConfig) {
                console.log('[Antilink] No antilink config found for this group');
                return;
        }

        const action = antilinkConfig.action;
        
        try {
                // Delete message first
                await sock.sendMessage(jid, { delete: msg.key });

                switch (action) {
                        case 'delete':
                                await sock.sendMessage(jid, { 
                                        text: `\`\`\`@${sender.split('@')[0]} link are not allowed here\`\`\``,
                                        mentions: [sender] 
                                });
                                break;

                        case 'kick':
                                await sock.groupParticipantsUpdate(jid, [sender], 'remove');
                                await sock.sendMessage(jid, {
                                        text: `\`\`\`@${sender.split('@')[0]} has been kicked for sending links\`\`\``,
                                        mentions: [sender]
                                });
                                break;

                        case 'warn':
                                const warningCount = await incrementWarningCount(jid, sender);
                                if (warningCount >= WARN_COUNT) {
                                        await sock.groupParticipantsUpdate(jid, [sender], 'remove');
                                        await resetWarningCount(jid, sender);
                                        await sock.sendMessage(jid, {
                                                text: `\`\`\`@${sender.split('@')[0]} has been kicked after ${WARN_COUNT} warnings\`\`\``,
                                                mentions: [sender]
                                        });
                                } else {
                                        await sock.sendMessage(jid, {
                                                text: `\`\`\`@${sender.split('@')[0]} warning ${warningCount}/${WARN_COUNT} for sending links\`\`\``,
                                                mentions: [sender]
                                        });
                                }
                                break;
                }
        } catch (error) {
                console.error('Error in Antilink:', error);
        }
}

module.exports = { Antilink };