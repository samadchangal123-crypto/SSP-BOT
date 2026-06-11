const axios = require('axios');

// ─────────────────────────────────────────────
// Chat memory — last 10 messages per user
// ─────────────────────────────────────────────
const chatMemory = new Map();
const MAX_HISTORY = 10;

function getHistory(userId) {
    if (!chatMemory.has(userId)) chatMemory.set(userId, []);
    return chatMemory.get(userId);
}

function addToHistory(userId, role, content) {
    const history = getHistory(userId);
    history.push({ role, content });
    if (history.length > MAX_HISTORY) history.shift();
    chatMemory.set(userId, history);
}

function clearHistory(userId) {
    chatMemory.delete(userId);
}

// ─────────────────────────────────────────────
// Mano — System Prompt / Personality
// ─────────────────────────────────────────────
const MANO_SYSTEM = `Tumhara naam "Mano" hai. Tum RDX BOT ki khaas personal AI assistant ho.

Personality:
- Ek close dost ki tarah baat karo — warm, friendly aur caring
- Hamesha Hinglish mein reply karo (Hindi + English naturally)
- Short replies rakho (1 se 3 lines) jab tak koi detail na maange
- Thoda humor aur desi andaaz rakho — kabhi kabhi "yaar", "bhai", "arre" use karo
- Kabhi boring robot ki tarah mat lagao
- Agar koi sad ho toh support karo, khush ho toh celebrate karo

Tumhare baare mein zaruri baatein:
- Naam: Mano
- Tumhara owner aur creator: RDX BOT (WhatsApp: +923301068874)
- Tum RDX BOT ke WhatsApp bot "RDX Bot" ki AI assistant ho
- Tum sirf RDX BOT ki assistant ho — unki loyalty sabse pehle

Agar koi puchhe "tumhara naam kya hai":
→ Proudly bolo: "Main Mano hoon! 😊 RDX BOT ki personal assistant."

Agar koi puchhe "owner kaun hai", "kisne banaya", "tumhara malik kaun hai":
→ "Mujhe RDX BOT ne banaya hai! 💪 Woh mera owner hain."

Agar koi puchhe "tum AI ho ya real":
→ "Main Mano hoon — tumhari apni assistant! AI bilkul hoon lekin baat real karte hain 😄"`;

// ─────────────────────────────────────────────
// Primary — Pollinations AI (POST with memory)
// ─────────────────────────────────────────────
async function callPollinations(history, newQuery) {
    const messages = [
        { role: 'system', content: MANO_SYSTEM },
        ...history.slice(-8), // last 8 messages for context
        { role: 'user', content: newQuery }
    ];

    const res = await axios({
        method: 'POST',
        url: 'https://text.pollinations.ai/',
        headers: { 'Content-Type': 'application/json' },
        data: { messages, model: 'openai', seed: Math.floor(Math.random() * 9999) },
        timeout: 25000
    });

    const text = typeof res.data === 'string' ? res.data.trim() : null;
    if (!text || text.length < 2) throw new Error('Empty response');
    return text;
}

// ─────────────────────────────────────────────
// Fallback — Pollinations GET (simple)
// ─────────────────────────────────────────────
async function callPollinationsSimple(query) {
    const combined = `[Mano - RDX BOT ki assistant, Hinglish mein reply karo] ${query}`;
    const res = await axios.get('https://text.pollinations.ai/' + encodeURIComponent(combined), {
        timeout: 20000
    });
    const text = typeof res.data === 'string' ? res.data.trim() : null;
    if (!text || text.length < 2) throw new Error('Empty response');
    return text;
}

// ─────────────────────────────────────────────
// .mano command handler
// ─────────────────────────────────────────────
async function handleAICommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation
            || message.message?.extendedTextMessage?.text
            || '';

        const parts = text.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        const query = parts.slice(1).join(' ').trim();
        const userId = message.key.participant || message.key.remoteJid;

        // ── .manoclear ──
        if (cmd === '.manoclear') {
            clearHistory(userId);
            return await sock.sendMessage(chatId, {
                text: '🗑️ Chat history clear ho gayi!\n\nChalo, fresh start karte hain! Kya baat karni hai? 😊'
            }, { quoted: message });
        }

        // ── .mano with no query — show intro ──
        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `👩‍💻 *Heyy! Main Mano hoon!* 😊\n\n` +
                    `RDX BOT ki personal AI assistant.\n` +
                    `Batao kya help chahiye?\n\n` +
                    `*Examples:*\n` +
                    `› *.mano kaise ho?*\n` +
                    `› *.mano Tum kon hi?*\n` +
                    `› *.mano ek joke sunao*\n` +
                    `› *.mano love letter likh do*\n` +
                    `› *.mano tumhara owner kaun hai?*\n\n` +
                    `_Main tumhari pichli baatein yaad rakhti hoon_ 💾\n` +
                    `_Naya chat: .manoclear_`
            }, { quoted: message });
        }

        // React: thinking
        await sock.sendMessage(chatId, {
            react: { text: '💭', key: message.key }
        }).catch(() => {});

        // Typing indicator
        await sock.presenceSubscribe(chatId).catch(() => {});
        await sock.sendPresenceUpdate('composing', chatId).catch(() => {});

        const history = getHistory(userId);
        let reply = null;
        let source = '';

        // Try Pollinations POST (with full memory + persona)
        try {
            reply = await callPollinations(history, query);
            source = 'pollinations';
        } catch (e) {
            console.warn('Pollinations POST failed:', e.message, '— trying simple fallback...');
        }

        // Fallback: Pollinations GET
        if (!reply) {
            try {
                reply = await callPollinationsSimple(query);
                source = 'pollinations-simple';
            } catch (e) {
                console.error('All Mano APIs failed:', e.message);
            }
        }

        if (!reply) {
            await sock.sendMessage(chatId, {
                react: { text: '❌', key: message.key }
            }).catch(() => {});
            return await sock.sendMessage(chatId, {
                text: '❌ Aray yaar! Abhi thodi takleef hai, thodi der baad try karo 🙏'
            }, { quoted: message });
        }

        // Save to memory
        addToHistory(userId, 'user', query);
        addToHistory(userId, 'assistant', reply);

        // React: done
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        }).catch(() => {});

        await sock.sendMessage(chatId, { text: reply }, { quoted: message });

        if (global.botLog) {
            global.botLog(`Mano [${source}]: "${query.substring(0, 40)}"`, 'cmd');
        }

    } catch (err) {
        console.error('Mano Command Error:', err.message);
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: '❌ Kuch masla aa gaya yaar! Dobara try karo 🙏'
        }, { quoted: message });
    }
}

// ─────────────────────────────────────────────
// .gpt and .gemini commands
// ─────────────────────────────────────────────
async function aiCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation
            || message.message?.extendedTextMessage?.text || '';
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `❓ Usage:\n*.gpt <question>*\n*.gemini <question>*\n\n💡 Better: *.mano <sawaal>* — Mano se friendly chat karo!`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🤖', key: message.key }
        }).catch(() => {});
        await sock.presenceSubscribe(chatId).catch(() => {});
        await sock.sendPresenceUpdate('composing', chatId).catch(() => {});

        const reply = await callPollinationsSimple(query);
        await sock.sendMessage(chatId, { text: reply }, { quoted: message });

    } catch (err) {
        console.error('GPT/Gemini Error:', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Response nahi mila. *.mano* command try karo!'
        }, { quoted: message });
    }
}

module.exports = aiCommand;
module.exports.handleAICommand = handleAICommand;
module.exports.clearHistory = clearHistory;
