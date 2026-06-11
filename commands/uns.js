async function unsCommand(sock, chatId, message, senderId) {
    try {
        const isGroup = chatId.endsWith('@g.us');

        const ctxInfo = message.message?.extendedTextMessage?.contextInfo
            || message.message?.imageMessage?.contextInfo
            || message.message?.videoMessage?.contextInfo
            || message.message?.audioMessage?.contextInfo
            || message.message?.stickerMessage?.contextInfo
            || {};

        const stanzaId = ctxInfo.stanzaId;
        const participant = ctxInfo.participant || ctxInfo.remoteJid;

        if (!stanzaId) {
            await sock.sendMessage(chatId, {
                text: '❌ Jis message ko delete karna ho us par reply kar ke .uns likho!'
            }, { quoted: message });
            return;
        }

        // Check if replied message is from the bot
        const botJid = sock.user.id;
        const botNumber = botJid.split(':')[0].split('@')[0];
        const botLid = sock.user?.lid || '';
        const botLidNum = botLid.split(':')[0].split('@')[0];

        const participantNum = (participant || '').split(':')[0].split('@')[0];

        const isBotMessage = participant && (
            participant === botJid ||
            participant === botNumber + '@s.whatsapp.net' ||
            participantNum === botNumber ||
            (botLidNum && participantNum === botLidNum) ||
            (botLid && participant === botLid) ||
            participant.includes(botNumber)
        );

        // --- Bot's own message: always delete ---
        if (isBotMessage) {
            try {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: true,
                        id: stanzaId,
                        participant: isGroup ? botJid : undefined
                    }
                });
            } catch (e) {
                console.log('[uns] Bot msg delete error:', e.message);
                try {
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: true,
                            id: stanzaId
                        }
                    });
                } catch (e2) {
                    console.log('[uns] Retry delete error:', e2.message);
                }
            }
            return;
        }

        // --- Other member's message in group: need admin ---
        if (isGroup) {
            let isBotAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                const botInGroup = meta.participants.find(p => {
                    const pNum = (p.id || '').split(':')[0].split('@')[0];
                    const pLidNum = (p.lid || '').split(':')[0].split('@')[0];
                    return pNum === botNumber || (botLidNum && pLidNum === botLidNum);
                });
                isBotAdmin = botInGroup?.admin === 'admin' || botInGroup?.admin === 'superadmin';
            } catch {}

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, {
                    text: '❌ Bot admin nahi hai, sirf apna message delete kar sakta hai!'
                }, { quoted: message });
                return;
            }

            try {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: stanzaId,
                        participant: participant
                    }
                });
            } catch (e) {
                console.log('[uns] Group delete error:', e.message);
                await sock.sendMessage(chatId, {
                    text: '❌ Message delete nahi hua!'
                }, { quoted: message });
            }
            return;
        }

        // --- DM: try to delete ---
        try {
            await sock.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe: false,
                    id: stanzaId
                }
            });
        } catch (e) {
            console.log('[uns] DM delete error:', e.message);
        }

    } catch (err) {
        console.log('[uns] Error:', err.message);
    }
}

module.exports = unsCommand;
