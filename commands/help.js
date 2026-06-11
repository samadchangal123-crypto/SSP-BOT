const fs       = require('fs');
const path     = require('path');
const settings = require('../rdx-settings');
const COMMANDS = require('./commandList');

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

// Auto-scan rdx-core.js for commands not already in commandList.js
function scanNewCommands() {
    try {
        const corePath = path.join(__dirname, '../rdx-core.js');
        const code     = fs.readFileSync(corePath, 'utf8');

        // Collect all commands already in commandList
        const known = new Set();
        for (const cmds of Object.values(COMMANDS)) {
            for (const { cmd } of cmds) {
                // Extract the first word of cmd e.g. ".ban @user" → ".ban"
                cmd.split(/[\s/]/)[0].trim().split(',').forEach(c => {
                    const clean = c.trim().replace(/\./g, '');
                    if (clean) known.add(clean);
                });
            }
        }

        // Regex patterns to extract command names from switch cases
        const patterns = [
            /case\s+userMessage\s*===\s*['"`](\.[\w]+)['"` ]/g,
            /case\s+userMessage\.startsWith\(['"`](\.[\w]+)['"` ]/g,
        ];

        const found = new Set();
        for (const re of patterns) {
            let m;
            while ((m = re.exec(code)) !== null) {
                const cmd = m[1].replace('.', '');
                if (!known.has(cmd)) found.add(m[1]);
            }
        }

        if (found.size === 0) return null;

        return [...found].map(cmd => ({ cmd, desc: 'Available' }));
    } catch (e) {
        return null;
    }
}

function buildHelpMessage() {
    const prefix = settings.prefix || '.';
    const lines  = [];

    lines.push(`╭━━━━━━━━━━━━━━━━━━━━━━━╮`);
    lines.push(`┃  ✦ *${settings.botName}* ✦`);
    lines.push(`┃  ⚡ *COMMAND LIST* ⚡`);
    lines.push(`╰━━━━━━━━━━━━━━━━━━━━━━━╯`);
    lines.push(`┃ 🏷 *Bot:* ${settings.botName}`);
    lines.push(`┃ 📌 *Version:* ${settings.version}`);
    lines.push(`┃ 👑 *Owner:* ${settings.botOwner}`);
    lines.push(`┃ 🔑 *Prefix:* \`${prefix}\``);
    lines.push(`╰━━━━━━━━━━━━━━━━━━━━━━━╯`);
    lines.push('');

    // Commands from commandList.js (with categories & descriptions)
    for (const [category, cmds] of Object.entries(COMMANDS)) {
        lines.push(`╭━━━━━━━━━━━━━━━━━━━━━━━╮`);
        lines.push(`┃  *${category}*`);
        lines.push(`╰━━━━━━━━━━━━━━━━━━━━━━━╯`);
        for (const { cmd, desc } of cmds) {
            lines.push(`┃ ⌘ *${cmd}*  — ${desc}`);
        }
        lines.push('');
    }

    // Auto-scanned new commands not yet in commandList.js
    const newCmds = scanNewCommands();
    if (newCmds && newCmds.length > 0) {
        lines.push(`╭━━━━━━━━━━━━━━━━━━━━━━━╮`);
        lines.push(`┃  *🆕 NEW COMMANDS*`);
        lines.push(`╰━━━━━━━━━━━━━━━━━━━━━━━╯`);
        for (const { cmd } of newCmds) {
            lines.push(`┃ ⌘ *${cmd}*`);
        }
        lines.push('');
    }

    lines.push(`╭━━━━━━━━━━━━━━━━━━━━━━━╮`);
    lines.push(`┃  📢 *JOIN OUR CHANNEL*`);
    lines.push(`┃  https://whatsapp.com/channel/120363424217332934`);
    lines.push(`╰━━━━━━━━━━━━━━━━━━━━━━━╯`);
    lines.push(`🤖 *Powered by RDX BOT v${settings.version}*`);

    return lines.join('\n');
}

async function helpCommand(sock, chatId, message) {
    try {
        const helpMessage = buildHelpMessage();

        const images    = ['RDX1.jpg', 'RDX2.jpg', 'RDX3.jpg', 'RDX4.jpg', 'RDX5.jpg', 'RDX6.jpg'];
        const randomImg = images[Math.floor(Math.random() * images.length)];
        const imagePath = path.join(__dirname, '../assets', randomImg);

        if (fs.existsSync(imagePath)) {
            const imgBuffer = fs.readFileSync(imagePath);
            await sock.sendMessage(chatId, {
                image: imgBuffer,
                caption: helpMessage,
                ...channelContext
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: helpMessage,
                ...channelContext
            }, { quoted: message });
        }
    } catch (err) {
        console.error('[help] Error:', err.message);
        await sock.sendMessage(chatId, { text: buildHelpMessage() }, { quoted: message });
    }
}

module.exports = helpCommand;
