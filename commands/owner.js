const fs = require('fs');
const path = require('path');
const settings = require('../rdx-settings');

const channelContext = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363407914650384@newsletter',
            newsletterName: 'RDX BOT',
            serverMessageId: -1
        }
    }
};

async function ownerCommand(sock, chatId) {
    try {
        const ownerNum = Array.isArray(settings.ownerNumber)
            ? settings.ownerNumber[0]
            : settings.ownerNumber;

        const caption = `╭━━━━━━━━━━━━━━━━━━━━╮
┃   👑 *BOT OWNER INFO*
╰━━━━━━━━━━━━━━━━━━━━╯

👤 *Name:* RDX BOT
📱 *WhatsApp:* +${ownerNum}
▶️ *YouTube:* youtube.com/@rdx-bot-zone
📢 *Group:* https://chat.whatsapp.com/DFkSXrdpOgTAZBiEDBcF50?mode=gi_t 
🤖 *Bot:* ${settings.botName || 'RDX BOT'}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ Owner se contact karne ke liye
┃ WhatsApp number par message karo
╰━━━━━━━━━━━━━━━━━━━━╯

🤖 *Powered by RDX BOT*`;

        const ownerImages = ['RDX1.jpg', 'RDX2.jpg', 'RDX3.jpg', 'RDX4.jpg', 'RDX5.jpg', 'RDX6.jpg'];
        const randomOwnerImg = ownerImages[Math.floor(Math.random() * ownerImages.length)];
        const imgPath = path.join(process.cwd(), 'assets', randomOwnerImg);

        if (fs.existsSync(imgPath)) {
            const imgBuffer = fs.readFileSync(imgPath);
            await sock.sendMessage(chatId, {
                image: imgBuffer,
                caption,
                ...channelContext
            });
        } else {
            await sock.sendMessage(chatId, {
                text: caption,
                ...channelContext
            });
        }

        // Contact card
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:RDX BOT\nTEL;waid=${ownerNum}:+${ownerNum}\nEND:VCARD`;
        await sock.sendMessage(chatId, {
            contacts: {
                displayName: 'RDX BOT',
                contacts: [{ vcard }]
            }
        });

    } catch (error) {
        console.error('[owner] Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Owner info load karne mein error aa gaya.' });
    }
}

module.exports = ownerCommand;
