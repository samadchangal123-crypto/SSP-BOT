const settings = require("../rdx-settings");
async function aliveCommand(sock, chatId, message) {
    try {
        const message1 = `
╭━━━━━━━━━━━━━━━━━━╮
│  ✦ 𝑺𝑨𝑹𝑫𝑨𝑹 𝑹𝑫𝑿 𝑩𝑶𝑻  ✦
│  ⚡ 𝑨성 𝑨성 𝑩𝑶𝑻 𝑺𝑻𝑨𝑹𝑻𝑬𝑫  ⚡
╰━━━━━━━━━━━━━━━━━━╯
┃ ⎔ Version: ${settings.version}
┃ ❂ Status: ◉ Online
┃ ✪ Mode: ${settings.commandMode}
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ ✨ 𝑭𝑬𝑨𝑻𝑼𝑹𝑬𝑺:
┃ ♛ 𝑮𝑹𝑶𝑼𝑷 𝑴𝑨𝑵𝑨𝑮𝑬𝑴𝑬𝑵𝑻
┃ ♛ 𝑨𝑵𝑻𝑰𝑳𝑰𝑵𝑲 𝑷𝑹𝑶𝑻𝑬𝑪𝑻𝑰𝑶𝑵
┃ ♛ 𝑭𝑼𝑵 𝑪𝑶𝑴𝑴𝑨𝑵𝑫𝑺
┃ ♛ 𝑨𝑰 𝑪𝑶𝑴𝑴𝑨𝑵𝑫𝑺
┃ ♛ 𝑨𝑵𝑫 𝑴𝑶𝑹𝑰!
╰━━━━━━━━━━━━━━━━━━━━━╯
 💭 Type *.menu* for full command list`;

        await sock.sendMessage(chatId, {
            text: message1,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363407914650384@newsletter',
                    newsletterName: 'RDX BOT',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: 'Bot is alive and running!' }, { quoted: message });
    }
}

module.exports = aliveCommand;