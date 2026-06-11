const fs = require('fs');
const { channelInfo } = require('../lib/messageConfig');
const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');

async function banCommand(sock, chatId, message) {
    // Restrict in groups to admins; in private to owner/sudo
    const isGroup = chatId.endsWith('@g.us');
    if (isGroup) {
        const senderId = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ⚠️ 𝑨𝑪𝑪𝑬𝑺𝑺 𝑫𝑬𝑵𝑰𝑬𝑫 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\nMake bot admin first to use .ban`, ...channelInfo }, { quoted: message });
            return;
        }
        if (!isSenderAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ⚠️ 𝑷𝑬𝑹𝑴𝑰𝑺𝑺𝑰𝑶𝑵 𝑫𝑬𝑵𝑰𝑬𝑫 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\nOnly group admins can use .ban`, ...channelInfo }, { quoted: message });
            return;
        }
    } else {
        const senderId = message.key.participant || message.key.remoteJid;
        const senderIsSudo = await isSudo(senderId);
        if (!message.key.fromMe && !senderIsSudo) {
            await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ⚠️ 𝑷𝑬𝑹𝑴𝑰𝑺𝑺𝑰𝑶𝑵 𝑫𝑬𝑵𝑰𝑬𝑫 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\nOnly owner/sudo can use .ban in private chat`, ...channelInfo }, { quoted: message });
            return;
        }
    }
    let userToBan;
    
    // Check for mentioned users
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        userToBan = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToBan = message.message.extendedTextMessage.contextInfo.participant;
    }
    
    if (!userToBan) {
        await sock.sendMessage(chatId, { 
            text: 'Please mention the user or reply to their message to ban!', 
            ...channelInfo 
        });
        return;
    }

    // Prevent banning the bot itself
    try {
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        if (userToBan === botId || userToBan === botId.replace('@s.whatsapp.net', '@lid')) {
            await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ⚠️ 𝑷𝑹𝑶𝑯𝑰𝑩𝑰𝑻𝑬𝑫 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\nYou cannot ban the bot account!`, ...channelInfo }, { quoted: message });
            return;
        }
    } catch {}

    try {
        // Ensure data directory exists
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }
        // Add user to banned list
        const bannedUsers = fs.existsSync('./data/banned.json') 
            ? JSON.parse(fs.readFileSync('./data/banned.json')) 
            : [];
        if (!bannedUsers.includes(userToBan)) {
            bannedUsers.push(userToBan);
            fs.writeFileSync('./data/banned.json', JSON.stringify(bannedUsers, null, 2));
            
            await sock.sendMessage(chatId, { 
                text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ✅ 𝑩𝑨𝑵𝑵𝑬𝑫 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\n@${userToBan.split('@')[0]} has been banned!`,
                mentions: [userToBan],
                ...channelInfo 
            });
        } else {
            await sock.sendMessage(chatId, { 
                text: `${userToBan.split('@')[0]} is already banned!`,
                mentions: [userToBan],
                ...channelInfo 
            });
        }
    } catch (error) {
        console.error('Error in ban command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to ban user!', ...channelInfo });
    }
}

module.exports = banCommand;
