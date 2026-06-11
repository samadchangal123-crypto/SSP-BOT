const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason,
    delay
} = require('@whiskeysockets/baileys');

const channelInfo = {
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

// Track active pair sessions to avoid spamming
const activeSessions = new Set();

async function generatePairCode(number) {
    const sessionDir = path.join(process.cwd(), 'temp', `pair_${number}_${Date.now()}`);
    fs.mkdirSync(sessionDir, { recursive: true });

    let sock;
    let cleaned = false;

    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        try { sock?.ws?.close?.(); } catch (_) {}
        try { sock?.end?.(undefined); } catch (_) {}
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
    };

    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: Browsers.macOS('Safari'),
            markOnlineOnConnect: false,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });

        sock.ev.on('creds.update', saveCreds);

        // Auto-disconnect when pairing actually succeeds (we don't want a real login here)
        sock.ev.on('connection.update', (u) => {
            if (u.connection === 'open' || u.connection === 'close') {
                setTimeout(cleanup, 1500);
            }
        });

        if (sock.authState.creds.registered) {
            cleanup();
            throw new Error('temp session unexpectedly registered');
        }

        // Wait briefly for the socket to be ready
        await delay(1500);

        let code = await sock.requestPairingCode(number);
        if (!code) throw new Error('No pairing code returned');
        code = code.replace(/-/g, '');
        const formatted = code.match(/.{1,4}/g)?.join('-') || code;

        // Cleanup after 60s if connection.update never fires
        setTimeout(cleanup, 60_000);

        return formatted;
    } catch (e) {
        cleanup();
        throw e;
    }
}

async function pairCommand(sock, chatId, message, q) {
    try {
        if (!q) {
            return await sock.sendMessage(chatId, {
                text: '📱 *Pair Code Generator*\n\nUsage: *.pair <number>*\nExample: .pair 923001234567\n\n_(Country code zaroor lagayein, koi `+` ya space ki zarurat nahi.)_',
                ...channelInfo
            }, { quoted: message });
        }

        const number = String(q).replace(/[^0-9]/g, '');

        if (number.length < 10 || number.length > 15) {
            return await sock.sendMessage(chatId, {
                text: '❌ Number sahi nahi hai. Country code ke saath 10–15 digits likhein.\nExample: *.pair 923001234567*',
                ...channelInfo
            }, { quoted: message });
        }

        if (activeSessions.has(number)) {
            return await sock.sendMessage(chatId, {
                text: '⏳ Is number ke liye pehle se ek pair request chal rahi hai. Thori der ruk kar dobara try karein.',
                ...channelInfo
            }, { quoted: message });
        }

        // Verify number is on WhatsApp (best-effort, don't block if it fails)
        try {
            const result = await sock.onWhatsApp(number + '@s.whatsapp.net');
            if (result && result[0] && result[0].exists === false) {
                return await sock.sendMessage(chatId, {
                    text: '❗ Yeh number WhatsApp par registered nahi hai.',
                    ...channelInfo
                }, { quoted: message });
            }
        } catch (_) {}

        await sock.sendMessage(chatId, {
            text: `⏳ Pairing code generate ho raha hai *+${number}* ke liye...\n_(15–30 second lag sakte hain)_`,
            ...channelInfo
        }, { quoted: message });

        activeSessions.add(number);
        let code;
        try {
            code = await generatePairCode(number);
        } finally {
            setTimeout(() => activeSessions.delete(number), 60_000);
        }

        await sock.sendMessage(chatId, {
            text:
`╭━━━━ 🔑 *PAIRING CODE* ━━━━╮

📱 Number: *+${number}*
🔢 Code: *${code}*

╰━━━━━━━━━━━━━━━━━━━━╯

📋 *Steps:*
1. WhatsApp khole > *Linked Devices*
2. *Link a device* tap karein
3. *Link with phone number instead* choose karein
4. Yeh code dalein: *${code}*

⏱ Code 60 second tak valid hai. Agar fail ho to dobara *.pair ${number}* chala lein.`,
            ...channelInfo
        }, { quoted: message });

    } catch (error) {
        console.error('[pair] error:', error);
        const msg = (error && error.message) ? error.message : 'unknown error';
        await sock.sendMessage(chatId, {
            text: `❌ Pair code generate nahi ho saka.\n\n*Reason:* ${msg}\n\nThori der baad dobara try karein.`,
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = pairCommand;
