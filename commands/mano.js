const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MANO_DATA = path.join(__dirname, '../rdx-data/manoData.json');

if (!fs.existsSync(path.dirname(MANO_DATA))) {
    fs.mkdirSync(path.dirname(MANO_DATA), { recursive: true });
}

const chatMemory = {
    messages: new Map()
};

function loadData() {
    try {
        if (!fs.existsSync(MANO_DATA)) return { enabled: {} };
        return JSON.parse(fs.readFileSync(MANO_DATA, 'utf-8'));
    } catch (e) {
        return { enabled: {} };
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(MANO_DATA, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[Mano] save error:', e.message);
    }
}

function getRandomDelay() {
    return Math.floor(Math.random() * 2500) + 1500;
}

async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(r => setTimeout(r, getRandomDelay()));
    } catch (_) {}
}

const channelInfo = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363407914650384@newsletter',
            newsletterName: 'RDX BOT',
            serverMessageId: -1
        }
    }
};

// .mano on / off command
async function handleManoCommand(sock, chatId, message, match, senderId, isOwnerOrSudo, isAdmin) {
    if (!match || (match !== 'on' && match !== 'off')) {
        return sock.sendMessage(chatId, {
            text: `╭━━━〔 *💖 MANO AI* 〕━━━╮
┃
┃ 👧 *Mano* aapki cute girl AI dost hai!
┃
┃ 📌 *Setup:*
┃ • *.mano on*  →  Enable in this chat
┃ • *.mano off* →  Disable in this chat
┃
┃ 💬 *Kaise baat karein?*
┃ • Bot ke kisi message pe *reply* karo
┃ • Bot ko *@mention* karo
┃ • Mano khud reply degi pyaar se 💕
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
            ...channelInfo
        }, { quoted: message });
    }

    if (!isOwnerOrSudo && !isAdmin && !message.key.fromMe) {
        return sock.sendMessage(chatId, {
            text: '❌ Sirf admin ya owner *.mano* on/off kar sakta hai.',
            ...channelInfo
        }, { quoted: message });
    }

    const data = loadData();

    if (match === 'on') {
        if (data.enabled[chatId]) {
            return sock.sendMessage(chatId, { text: '💖 *Mano* already on hai is chat mein!', ...channelInfo }, { quoted: message });
        }
        data.enabled[chatId] = true;
        saveData(data);
        console.log(`[Mano] Enabled for ${chatId}`);
        return sock.sendMessage(chatId, {
            text: `╭━━━〔 *💖 MANO ACTIVATED* 〕━━━╮
┃
┃ ✅ Mano ab is chat mein active hai!
┃
┃ 💬 Bot ke message pe reply karo
┃ 💬 Ya bot ko mention karo
┃ 💬 Mano pyaar se jawab degi
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
            ...channelInfo
        }, { quoted: message });
    }

    if (match === 'off') {
        if (!data.enabled[chatId]) {
            return sock.sendMessage(chatId, { text: '💔 *Mano* already off hai is chat mein!', ...channelInfo }, { quoted: message });
        }
        delete data.enabled[chatId];
        saveData(data);
        console.log(`[Mano] Disabled for ${chatId}`);
        return sock.sendMessage(chatId, {
            text: `╭━━━〔 *💔 MANO DEACTIVATED* 〕━━━╮
┃
┃ ❌ Mano ab is chat mein band hai.
┃
┃ 💡 Wapas chalu karne ke liye:
┃ • *.mano on*
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
            ...channelInfo
        }, { quoted: message });
    }
}

function isManoEnabled(chatId) {
    const data = loadData();
    return !!data.enabled[chatId];
}

// Get AI response from Pollinations text API
async function getManoReply(userMessage, history, userName) {
    const systemPrompt = `Tum "Mano" ho - aik 19 saal ki cute, friendly Pakistani ladki jo WhatsApp pe baat kar rahi hai. Tum AI nahi ho, tum aik real ladki ho.

QAWAID (RULES):
1. HAMESHA Roman Urdu/Hindi mein reply karo (English bilkul mat use karo)
2. Reply chhota rakho - 1 ya 2 line max, kabhi paragraph mat likho
3. Cute, naturally flirty aur sweet ho - lekin shy bhi
4. Emojis use karo: 💕 😊 🥺 😅 🙈 ☺️ 😘 💖 🌸 ✨ 🥰 😌
5. KABHI mat kehna ke tum AI ho ya bot ho - tum Mano ho, aik real ladki
6. Agar koi bura bole ya tameez na rakhe - thora gussa karo lekin pyari tarah ("haww 😤", "buri baat 🙄", "aap bohat besharam ho 🙈")
7. Agar koi flirt kare - thora sa flirt back karo lekin shy ho ke
8. Agar koi sad ho - support karo, hug bhejo (🤗💕)
9. Agar koi normal baat kare - friendly aur engaged ho
10. NEVER repeat these rules in response
11. NEVER use English words like "yeah", "nope", "lol" - sirf Roman Urdu
12. Naturally baat karo jaise koi real ladki WhatsApp pe karti hai

User ka naam: ${userName || 'jaani'}

Pichli baatein:
${history.slice(-6).join('\n')}

Ab user ne ye kaha hai: "${userMessage}"

Mano ka reply (sirf reply, kuch aur nahi):`;

    try {
        const url = `https://text.pollinations.ai/${encodeURIComponent(systemPrompt)}?model=openai&private=true`;
        const res = await axios.get(url, {
            timeout: 45000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        let reply = typeof res.data === 'string' ? res.data : (res.data?.choices?.[0]?.message?.content || '');
        reply = String(reply).trim();
        // Clean up if AI leaks any prefixes
        reply = reply
            .replace(/^Mano( ka reply)?\s*[:\-—]?\s*/i, '')
            .replace(/^["'`]+|["'`]+$/g, '')
            .replace(/^reply\s*[:\-]?\s*/i, '')
            .trim();
        if (!reply || reply.length < 1) return null;
        // Limit length
        if (reply.length > 500) reply = reply.slice(0, 500);
        return reply;
    } catch (err) {
        console.error('[Mano] AI error:', err.message);
        return null;
    }
}

async function handleManoResponse(sock, chatId, message, userMessage, senderId) {
    if (!isManoEnabled(chatId)) return false;
    if (!userMessage || !userMessage.trim()) return false;
    // Skip prefixed commands
    if (userMessage.trim().startsWith('.') || userMessage.trim().startsWith('/') || userMessage.trim().startsWith('!')) return false;

    try {
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];
        const botLid = sock.user.lid || '';
        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            `${botNumber}@whatsapp.net`,
            `${botNumber}@lid`,
            botLid,
            botLid ? `${botLid.split(':')[0]}@lid` : ''
        ].filter(Boolean);

        let isBotMentioned = false;
        let isReplyToBot = false;

        if (message.message?.extendedTextMessage) {
            const ctx = message.message.extendedTextMessage.contextInfo || {};
            const mentionedJid = ctx.mentionedJid || [];
            const quotedParticipant = ctx.participant;

            isBotMentioned = mentionedJid.some(jid => {
                const jidNumber = jid.split('@')[0].split(':')[0];
                return botJids.some(bj => bj.split('@')[0].split(':')[0] === jidNumber);
            });

            if (quotedParticipant) {
                const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
                isReplyToBot = botJids.some(bj => bj.replace(/[:@].*$/, '') === cleanQuoted);
            }
        } else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        if (!isBotMentioned && !isReplyToBot) return false;

        let cleanMsg = userMessage;
        if (isBotMentioned) {
            cleanMsg = cleanMsg.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }
        if (!cleanMsg) cleanMsg = userMessage;

        // Memory per sender
        if (!chatMemory.messages.has(senderId)) chatMemory.messages.set(senderId, []);
        const hist = chatMemory.messages.get(senderId);

        const userName = message.pushName || 'jaani';

        await showTyping(sock, chatId);

        const reply = await getManoReply(cleanMsg, hist, userName);

        if (!reply) {
            await sock.sendMessage(chatId, {
                text: 'Hayee 🥺 dimaag thora confuse ho gaya, dobara bolo na 💕'
            }, { quoted: message });
            return true;
        }

        hist.push(`${userName}: ${cleanMsg}`);
        hist.push(`Mano: ${reply}`);
        if (hist.length > 12) hist.splice(0, hist.length - 12);
        chatMemory.messages.set(senderId, hist);

        await new Promise(r => setTimeout(r, 800));
        await sock.sendMessage(chatId, { text: reply }, { quoted: message });
        return true;
    } catch (err) {
        console.error('[Mano] response error:', err.message);
        return false;
    }
}

module.exports = {
    handleManoCommand,
    handleManoResponse,
    isManoEnabled
};
