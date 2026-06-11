const fs = require('fs');
const path = require('path');
const os = require('os');
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

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    let parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

async function infoCommand(sock, chatId, message) {
    try {
        const ownerNum = Array.isArray(settings.ownerNumber)
            ? settings.ownerNumber[0]
            : settings.ownerNumber;

        const uptime = formatUptime(process.uptime());
        const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
        const platform = os.platform();
        const nodeVer = process.version;

        const caption = `╭━━━━━━━━━━━━━━━━━━━━━╮
┃   🤖 *RDX BOT — FULL INFO*
╰━━━━━━━━━━━━━━━━━━━━━╯

┌─── 🤖 *BOT INFO* ────────────
│ 📛 Name    : ${settings.botName || 'RDX BOT'}
│ 📦 Version : ${settings.version}
│ 🔑 Prefix  : ${settings.prefix || '.'}
│ 🌐 Mode    : ${settings.commandMode || 'public'}
│ ⏱ Uptime  : ${uptime}
│ 💾 Memory  : ${memUsed} MB
└──────────────────────────────

┌─── 👑 *OWNER INFO* ──────────
│ 👤 Name    : RDX BOT
│ 📱 Number  : +${ownerNum}
│ ▶️ YouTube : @rdx-bot-zone
│ 📢 WPgroup : https://chat.whatsapp.com/DFkSXrdpOgTAZBiEDBcF50?mode=gi_t
└──────────────────────────────

┌─── 🖥 *SYSTEM* ───────────────
│ 🐧 OS      : ${platform}
│ 🟢 Node    : ${nodeVer}
│ 🏠 RAM     : ${memUsed} / ${totalMem} MB
└──────────────────────────────

🤖 *Powered by RDX BOT v${settings.version}*`;

        const infoImages = ['RDX1.jpg', 'RDX2.jpg', 'RDX3.jpg', 'RDX4.jpg', 'RDX5.jpg', 'RDX6.jpg'];
        const randomInfoImg = infoImages[Math.floor(Math.random() * infoImages.length)];
        const imgPath = path.join(process.cwd(), 'assets', randomInfoImg);

        if (fs.existsSync(imgPath)) {
            const imgBuffer = fs.readFileSync(imgPath);
            await sock.sendMessage(chatId, {
                image: imgBuffer,
                caption,
                ...channelContext
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: caption,
                ...channelContext
            }, { quoted: message });
        }

    } catch (error) {
        console.error('[info] Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Info load karne mein error aa gaya.' }, { quoted: message });
    }
}

module.exports = infoCommand;
