const fs   = require('fs');
const path = require('path');

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

async function reloadCommand(sock, chatId, message, args) {
    const arg = (args || '').trim().toLowerCase();
    const commandsDir = path.join(__dirname);

    if (arg === 'list') {
        const files = fs.readdirSync(commandsDir)
            .filter(f => f.endsWith('.js'))
            .map(f => f.replace(/\.js$/, ''))
            .sort();
        const chunks = [];
        let buf = '';
        for (const f of files) {
            const piece = `• ${f}\n`;
            if ((buf + piece).length > 3500) { chunks.push(buf); buf = ''; }
            buf += piece;
        }
        if (buf) chunks.push(buf);

        await sock.sendMessage(chatId, {
            text: `📂 *Reloadable Commands (${files.length})*\n\n${chunks[0]}\nUsage: .reload <name>`,
            ...channelContext
        }, { quoted: message });
        return;
    }

    if (arg && arg !== 'all') {
        const safeName = arg.replace(/[^a-z0-9_-]/g, '');
        if (!safeName) {
            await sock.sendMessage(chatId, {
                text: '❌ Galat naam.\n\nUsage:\n.reload                 (full bot restart)\n.reload <commandName>   (validate + full restart)\n.reload all             (validate all + full restart)\n.reload list',
                ...channelContext
            }, { quoted: message });
            return;
        }

        const targetFile = path.join(commandsDir, `${safeName}.js`);
        if (!fs.existsSync(targetFile)) {
            await sock.sendMessage(chatId, {
                text: `❌ \`commands/${safeName}.js\` nahi mili.\n\nList ke liye: *.reload list*`,
                ...channelContext
            }, { quoted: message });
            return;
        }

        try {
            delete require.cache[require.resolve(targetFile)];
            require(targetFile);
        } catch (e) {
            await sock.sendMessage(chatId, {
                text: `❌ Syntax error in *${safeName}.js*:\n\n\`\`\`${e.message}\`\`\`\n\nRestart cancel kar diya.`,
                ...channelContext
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text:
`✅ *${safeName}.js* validate ho gaya.

♻️ Bot restart ho raha hai taaki edits live ho jayein...
Bot ~5-10 second mein wapis online ho jayega.`,
            ...channelContext
        }, { quoted: message });

        setTimeout(() => process.exit(0), 1500);
        return;
    }

    if (arg === 'all') {
        const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
        let ok = 0, fail = 0;
        const errors = [];
        for (const f of files) {
            const full = path.join(commandsDir, f);
            try {
                delete require.cache[require.resolve(full)];
                require(full);
                ok++;
            } catch (e) {
                fail++;
                errors.push(`• ${f}: ${e.message}`);
            }
        }

        if (fail > 0) {
            let text =
`❌ *Reload abort* — ${fail} file(s) mein syntax error hai. Restart nahi hua.

✅ OK: ${ok}
❌ Fail: ${fail}

*Errors:*
${errors.slice(0, 10).join('\n')}`;
            await sock.sendMessage(chatId, { text, ...channelContext }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text:
`✅ *All ${ok} commands* validate ho gaye.

♻️ Bot restart ho raha hai taaki sari edits live ho jayein...
Bot ~5-10 second mein wapis online ho jayega.`,
            ...channelContext
        }, { quoted: message });

        setTimeout(() => process.exit(0), 1500);
        return;
    }

    await sock.sendMessage(chatId, {
        text:
`♻️ *Bot restart ho raha hai...*

Sari files (rdx-core, commands, lib) reload hongi.
Bot ~5-10 second mein wapis online ho jaye ga.`,
        ...channelContext
    }, { quoted: message });

    setTimeout(() => process.exit(0), 1500);
}

module.exports = reloadCommand;
