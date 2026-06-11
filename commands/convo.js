const fs = require('fs');
const path = require('path');

const CONVO_DIR = path.join(process.cwd(), 'convo');
const DATA_PATH = path.join(process.cwd(), 'rdx-data', 'convo-active.json');

// setupSessions: senderId → wizard state object
const setupSessions = new Map();

// activeConvos: convoId → running convo config
const activeConvos = new Map();

let nextConvoId = 1;

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function formatJid(input) {
    input = (input || '').trim();
    if (input.endsWith('@g.us') || input.endsWith('@s.whatsapp.net')) return input;
    if (/^\d{10,15}$/.test(input)) return input + '@s.whatsapp.net';
    if (/^\d{5,}-\d{10,}$/.test(input)) return input + '@g.us';
    return null;
}

function getConvoFiles() {
    try {
        return fs.readdirSync(CONVO_DIR).filter(f => f.endsWith('.txt'));
    } catch (_) {
        return [];
    }
}

function readConvoFile(filePath) {
    const full = path.join(CONVO_DIR, filePath);
    if (!fs.existsSync(full)) return null;
    const lines = fs.readFileSync(full, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
    return lines.length > 0 ? lines : null;
}

function saveActiveConvos() {
    try {
        const data = {};
        for (const [id, c] of activeConvos.entries()) {
            data[id] = {
                convoId: c.convoId,
                destination: c.destination,
                heater: c.heater,
                filePath: c.filePath,
                speed: c.speed
            };
        }
        if (!fs.existsSync(path.join(process.cwd(), 'rdx-data'))) {
            fs.mkdirSync(path.join(process.cwd(), 'rdx-data'), { recursive: true });
        }
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[convo] saveActiveConvos error:', e);
    }
}

// ─── convo loop ─────────────────────────────────────────────────────────────

async function startConvoLoop(sock, config) {
    const { convoId, destination, heater, lines, speed } = config;
    const convo = activeConvos.get(convoId);

    while (convo && convo.running) {
        const idx = convo.index % lines.length;
        convo.index = idx + 1;

        let text = lines[idx];
        if (heater) text = `*${heater}* ${text}`;

        try {
            await sock.sendMessage(destination, { text });
        } catch (e) {
            console.error(`[convo] send error (${convoId}):`, e.message);
        }

        if (!convo.running) break;
        await sleep(speed * 1000);
    }

    console.log(`[convo] Loop ended for convoId=${convoId}`);
}

// ─── commands ────────────────────────────────────────────────────────────────

async function convoOnCommand(sock, chatId, senderId, message) {
    if (setupSessions.has(senderId)) setupSessions.delete(senderId);

    setupSessions.set(senderId, {
        step: 0,
        chatId,
        destination: null,
        heater: '',
        filePath: null,
        speed: 30,
        fileList: [],
        type: 'setup'
    });

    await sock.sendMessage(chatId, {
        text: `╭━━━━━━━━━━━━━━━━━━━━╮
┃   🤖 *CONVO SETUP* — Step 1/5
╰━━━━━━━━━━━━━━━━━━━━╯

📍 *Destination kahan bhejni hai?*

• Group JID bhejo (e.g. \`120363xxxxxx@g.us\`)
• Ya sirf phone number (e.g. \`923001234567\`)

💡 Current group JID pane ke liye *.getjid* use karo.

Type *skip* to skip.`
    }, { quoted: message });
}

async function convoOffCommand(sock, chatId, senderId, message) {
    if (activeConvos.size === 0) {
        await sock.sendMessage(chatId, {
            text: '❌ Koi bhi active convo nahi chal rahi abhi.'
        }, { quoted: message });
        return;
    }

    let list = `╭━━━━━━━━━━━━━━━━━━━━╮\n┃   🛑 *ACTIVE CONVOS*\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
    for (const [id, c] of activeConvos.entries()) {
        list += `*#${id}* → ${c.destination}\n📄 File: ${c.filePath}\n⏱ Speed: ${c.speed}s\n\n`;
    }
    list += `Kaunsi convo band karni hai?\n*Number bhejo* (e.g. \`1\`)`;

    setupSessions.set(senderId, { step: 'off', chatId, type: 'off' });
    await sock.sendMessage(chatId, { text: list }, { quoted: message });
}

// ─── session handler ─────────────────────────────────────────────────────────

async function handleConvoSession(sock, chatId, senderId, lowerText, rawText, message) {
    if (!setupSessions.has(senderId)) return false;
    const session = setupSessions.get(senderId);

    // ── OFF session ──────────────────────────────────
    if (session.type === 'off') {
        setupSessions.delete(senderId);
        const num = parseInt(lowerText.trim());
        if (isNaN(num) || !activeConvos.has(num)) {
            await sock.sendMessage(chatId, { text: '❌ Invalid number. Convo band nahi ki.' }, { quoted: message });
            return true;
        }
        const c = activeConvos.get(num);
        c.running = false;
        activeConvos.delete(num);
        saveActiveConvos();
        await sock.sendMessage(chatId, {
            text: `✅ *Convo #${num} band kar di gai!*\n📍 Destination: ${c.destination}`
        }, { quoted: message });
        return true;
    }

    // ── SETUP session ────────────────────────────────
    const reply = rawText.trim();
    const replyLower = lowerText.trim();

    switch (session.step) {

        // ── Step 0: destination ──────────────────────
        case 0: {
            if (replyLower !== 'skip') {
                const jid = formatJid(reply);
                if (!jid) {
                    await sock.sendMessage(chatId, {
                        text: '❌ Invalid destination. Sahi JID/number bhejo ya *skip* likho.\n\n💡 Current group JID pane ke liye *.getjid* type karo.'
                    }, { quoted: message });
                    return true;
                }
                session.destination = jid;
            }
            session.step = 1;
            await sock.sendMessage(chatId, {
                text: `╭━━━━━━━━━━━━━━━━━━━━╮\n┃   🤖 *CONVO SETUP* — Step 2/5\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n✏️ *Heater name kya rakhna hai?*\n\nYeh har message ke shuru mein lagega.\ne.g. \`RDX\` → *RDX* message text\n\nType *skip* for no prefix.`
            }, { quoted: message });
            return true;
        }

        // ── Step 1: heater ───────────────────────────
        case 1: {
            if (replyLower !== 'skip') {
                session.heater = reply;
            }
            session.step = 2;

            // Build numbered file list and save to session
            const files = getConvoFiles();
            session.fileList = files;

            let fileListText = '📂 *Available Files:*\n\n';
            if (files.length === 0) {
                fileListText += '_Koi file nahi mili. Default use hoga._';
            } else {
                files.forEach((f, i) => {
                    fileListText += `*${i + 1}.* ${f}\n`;
                });
            }

            await sock.sendMessage(chatId, {
                text: `╭━━━━━━━━━━━━━━━━━━━━╮\n┃   🤖 *CONVO SETUP* — Step 3/5\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n${fileListText}\n\n📄 *Number bhejo file select karne ke liye*\n(e.g. \`1\` ya \`2\`)\n\nType *skip* to use default.`
            }, { quoted: message });
            return true;
        }

        // ── Step 2: file selection by number ─────────
        case 2: {
            let filePath = null;

            if (replyLower === 'skip') {
                const defaultFile = path.join(CONVO_DIR, 'default.txt');
                if (!fs.existsSync(defaultFile)) {
                    fs.writeFileSync(defaultFile, 'Hello from RDX BOT!\nYeh ek sample convo message hai.\nRDX BOT is active!');
                }
                filePath = 'default.txt';
            } else {
                const num = parseInt(replyLower);
                const files = session.fileList || [];

                if (!isNaN(num) && num >= 1 && num <= files.length) {
                    // Selected by number
                    filePath = files[num - 1];
                } else {
                    // Maybe typed a filename directly
                    const cleaned = reply.replace(/^convo[\\/]/i, '');
                    if (files.includes(cleaned)) {
                        filePath = cleaned;
                    } else {
                        await sock.sendMessage(chatId, {
                            text: `❌ Invalid selection. List mein se number bhejo (1-${files.length}) ya *skip* karo.`
                        }, { quoted: message });
                        return true;
                    }
                }

                // Validate file is readable
                const lines = readConvoFile(filePath);
                if (!lines) {
                    await sock.sendMessage(chatId, {
                        text: `❌ File *${filePath}* read nahi ho saka. Dobara try karo.`
                    }, { quoted: message });
                    return true;
                }
            }

            session.filePath = filePath;
            session.step = 3;

            await sock.sendMessage(chatId, {
                text: `╭━━━━━━━━━━━━━━━━━━━━╮\n┃   🤖 *CONVO SETUP* — Step 4/5\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n⏱ *Message speed kitne seconds mein?*\n\nMin: 15s | Max: 120s\nDefault: 30s\n\nNumber bhejo (e.g. \`20\`) ya *skip*.`
            }, { quoted: message });
            return true;
        }

        // ── Step 3: speed ────────────────────────────
        case 3: {
            let speed = 30;
            if (replyLower !== 'skip') {
                const parsed = parseInt(replyLower);
                if (!isNaN(parsed) && parsed >= 15 && parsed <= 120) {
                    speed = parsed;
                } else {
                    await sock.sendMessage(chatId, {
                        text: '❌ Invalid speed. 15 se 120 ke beech number bhejo ya *skip* karo.'
                    }, { quoted: message });
                    return true;
                }
            }
            session.speed = speed;
            session.step = 4;

            const dest = session.destination || '_(no destination)_';
            const heater = session.heater || '_(none)_';
            const file = session.filePath || '_(none)_';

            await sock.sendMessage(chatId, {
                text: `╭━━━━━━━━━━━━━━━━━━━━╮\n┃   🤖 *CONVO SETUP* — Step 5/5\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n📋 *Summary:*\n📍 Destination: ${dest}\n✏️ Heater: ${heater}\n📄 File: ${file}\n⏱ Speed: ${speed}s\n\nSab theek hai?\n*confirm* likho shuru karne ke liye.\nKuch bhi aur likhne par cancel ho jaye ga.`
            }, { quoted: message });
            return true;
        }

        // ── Step 4: confirm ───────────────────────────
        case 4: {
            setupSessions.delete(senderId);

            if (replyLower !== 'confirm') {
                await sock.sendMessage(chatId, {
                    text: '❌ Convo setup cancel ho gaya.'
                }, { quoted: message });
                return true;
            }

            if (!session.destination) {
                await sock.sendMessage(chatId, {
                    text: '❌ Destination set nahi tha. Convo shuru nahi ho sakti.\n\n*.getjid* se group JID hasil karo aur dobara try karo.'
                }, { quoted: message });
                return true;
            }

            const lines = readConvoFile(session.filePath);
            if (!lines) {
                await sock.sendMessage(chatId, {
                    text: `❌ File *${session.filePath}* read nahi ho saka.`
                }, { quoted: message });
                return true;
            }

            const convoId = nextConvoId++;
            const config = {
                convoId,
                destination: session.destination,
                heater: session.heater,
                filePath: session.filePath,
                speed: session.speed,
                lines,
                index: 0,
                running: true,
                sock
            };
            activeConvos.set(convoId, config);
            saveActiveConvos();

            await sock.sendMessage(chatId, {
                text: `✅ *Convo #${convoId} shuru ho gai!*\n\n📍 Destination: ${session.destination}\n📄 File: ${session.filePath}\n⏱ Speed: ${session.speed}s\n\nBand karne ke liye: *.convo off*`
            }, { quoted: message });

            startConvoLoop(sock, config).catch(e => {
                console.error(`[convo] loop error (${convoId}):`, e);
            });

            return true;
        }

        default:
            setupSessions.delete(senderId);
            return false;
    }
}

module.exports = { convoOnCommand, convoOffCommand, handleConvoSession };
