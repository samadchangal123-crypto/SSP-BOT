const fs = require('fs');
const path = require('path');

const stateFile = path.join(__dirname, '../rdx-data/autoreact.json');

function readState() {
    try {
        if (!fs.existsSync(stateFile)) return { enabled: false };
        return JSON.parse(fs.readFileSync(stateFile));
    } catch (e) {
        return { enabled: false };
    }
}

function saveState(state) {
    if (!fs.existsSync(path.dirname(stateFile))) {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

const lovelyReacts = ['❤️', '💖', '💝', '💗', '💓', '💘', '💕', '✨', '🥰', '😍', '🌹', '🦋', '🌸', '🎈'];

async function autoreactCommand(sock, chatId, message, args) {
    const state = readState();
    const action = args.trim().toLowerCase();

    if (action === 'on') {
        state.enabled = true;
        saveState(state);
        await sock.sendMessage(chatId, { text: '✅ *Auto React has been enabled!* Bot will now react to every message with lovely emojis.' });
    } else if (action === 'off') {
        state.enabled = false;
        saveState(state);
        await sock.sendMessage(chatId, { text: '❌ *Auto React has been disabled!*' });
    } else {
        const status = state.enabled ? 'Enabled' : 'Disabled';
        await sock.sendMessage(chatId, { text: `*Auto React Status:* ${status}\n\nUsage: .autoreact on/off` });
    }
}

async function handleAutoReact(sock, chatId, message) {
    const state = readState();
    if (!state.enabled) return;
    if (message.key.fromMe) return;

    const randomReact = lovelyReacts[Math.floor(Math.random() * lovelyReacts.length)];
    try {
        await sock.sendMessage(chatId, {
            react: {
                text: randomReact,
                key: message.key
            }
        });
    } catch (e) {
        // ignore
    }
}

module.exports = { autoreactCommand, handleAutoReact };
