const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let bot = null;
const SESSION_DIR = path.join(__dirname, 'auth_info');
let botStatus = {
    connected: false,
    qrCode: null,
    number: null,
    startedAt: null,
    messages: [],
    contacts: []
};

async function initBot(phoneNumber) {
    try {
        if (bot) {
            try {
                await bot.logout();
            } catch (e) {}
            bot = null;
        }

        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(SESSION_DIR, { recursive: true });

        botStatus = {
            connected: false,
            qrCode: null,
            number: phoneNumber || null,
            startedAt: new Date().toISOString(),
            messages: [],
            contacts: []
        };

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        bot = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: { brand: 'RDX Bot', version: '1.0.0' }
        });

        bot.ev.on('creds.update', saveCreds);

        bot.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                QRCode.toDataURL(qr).then(url => {
                    botStatus.qrCode = url;
                    botStatus.connected = false;
                    io.emit('botUpdate', botStatus);
                });
            }

            if (connection === 'open') {
                botStatus.connected = true;
                botStatus.qrCode = null;
                botStatus.number = bot.user?.id?.split(':')[0];
                if (!botStatus.startedAt) {
                    botStatus.startedAt = new Date().toISOString();
                }
                io.emit('botUpdate', botStatus);
            }

            if (connection === 'close') {
                botStatus.connected = false;
                io.emit('botUpdate', botStatus);
            }
        });

        bot.ev.on('messages.upsert', ({ messages }) => {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const msgData = {
                        id: msg.key.id,
                        from: msg.key.remoteJid,
                        body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
                        timestamp: msg.messageTimestamp,
                        type: msg.message?.image ? 'image' : msg.message?.video ? 'video' : 'text',
                        fromMe: msg.key.fromMe
                    };
                    botStatus.messages.push(msgData);
                    if (botStatus.messages.length > 100) {
                        botStatus.messages = botStatus.messages.slice(-100);
                    }
                    io.emit('newMessage', msgData);
                }
            }
        });

    } catch (error) {
        console.error('Bot init error:', error);
    }
}

async function stopBot() {
    console.log('Stopping bot... disconnecting...');
    
    if (bot) {
        try {
            console.log('Closing WebSocket connection...');
            bot.ws.close();
        } catch (e) {
            console.log('WS close error:', e.message);
        }
        bot = null;
    }
    
    if (fs.existsSync(SESSION_DIR)) {
        try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            console.log('Session folder deleted');
        } catch (e) {
            console.log('Session delete error:', e.message);
        }
    }
    
    botStatus = {
        connected: false,
        qrCode: null,
        number: null,
        startedAt: null,
        messages: [],
        contacts: []
    };
    io.emit('botUpdate', botStatus);
    console.log('Bot fully disconnected and session cleared');
}

app.post('/api/bot/start', (req, res) => {
    const { ownerNumber } = req.body;
    initBot(ownerNumber);
    res.json({ success: true, message: 'Bot starting...' });
});

app.post('/api/bot/disconnect', async (req, res) => {
    try {
        await stopBot();
        res.json({ success: true, message: 'Bot logged out and session cleared' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/bot/stop', async (req, res) => {
    await stopBot();
    res.json({ success: true, message: 'Bot stopped' });
});

app.post('/api/bot/restart', (req, res) => {
    const { ownerNumber } = req.body;
    stopBot();
    setTimeout(() => {
        initBot(ownerNumber);
    }, 1000);
    res.json({ success: true, message: 'Bot restarting...' });
});

app.get('/api/bot/status', (req, res) => {
    res.json(botStatus);
});

app.post('/api/bot/send', async (req, res) => {
    const { number, message } = req.body;
    if (!bot || !botStatus.connected) {
        return res.json({ success: false, error: 'Bot not connected' });
    }
    try {
        await bot.sendMessage(number + '@s.whatsapp.net', { text: message });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post('/api/bot/pair', (req, res) => {
    const { phoneNumber, pairCode } = req.body;
    if (!phoneNumber) {
        return res.json({ success: false, error: 'Phone number required' });
    }
    stopBot();
    setTimeout(() => {
        initBot(phoneNumber);
    }, 1000);
    res.json({ success: true, message: 'Session cleared. New connection starting...' });
});

io.on('connection', (socket) => {
    socket.emit('botUpdate', botStatus);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});