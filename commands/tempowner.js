const isOwnerOrSudo = require('../lib/isOwner');
const { addSudo, removeSudo } = require('../lib/index');

// Pending sessions: senderJid -> { targetJid, chatId }
const pendingSessions = new Map();

// Active temp owners: targetJid -> { timer, expiry }
const activeTempOwners = new Map();

function extractMentionedJid(message) {
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length > 0) return mentioned[0];
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const match = text.match(/\b(\d{7,15})\b/);
    if (match) return match[1] + '@s.whatsapp.net';
    return null;
}

function parseTime(input) {
    input = input.trim().toLowerCase();
    const match = input.match(/^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours)$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    if (unit.startsWith('s')) return val * 1000;
    if (unit.startsWith('m')) return val * 60 * 1000;
    if (unit.startsWith('h')) return val * 60 * 60 * 1000;
    return null;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h} ghanta`);
    if (m > 0) parts.push(`${m} minute`);
    if (s > 0) parts.push(`${s} second`);
    return parts.join(' ') || '0 second';
}

async function tempOwnerCommand(sock, chatId, message) {
    const senderJid = message.key.participant || message.key.remoteJid;
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderJid, sock, chatId);

    if (!isOwner) {
        await sock.sendMessage(chatId, {
            text: '❌ Sirf owner ya sudo yeh command use kar sakta hai.'
        }, { quoted: message });
        return;
    }

    const targetJid = extractMentionedJid(message);
    if (!targetJid) {
        await sock.sendMessage(chatId, {
            text: '❌ Kisi ko mention karo ya number dalo.\nExample: .tempowner @user'
        }, { quoted: message });
        return;
    }

    const targetNum = targetJid.split('@')[0];

    // Save pending session for this sender
    pendingSessions.set(senderJid, { targetJid, chatId });

    await sock.sendMessage(chatId, {
        text: `⏳ *Temporary Owner Setup*\n\n📱 Number: *${targetNum}*\n\nKitne time ka liye temporary owner banana hai?\n\n_Reply karo (e.g. 10m, 1h, 30s)_`
    }, { quoted: message });
}

async function handleTempOwnerReply(sock, chatId, message) {
    const senderJid = message.key.participant || message.key.remoteJid;

    if (!pendingSessions.has(senderJid)) return false;

    const { targetJid, chatId: pendingChatId } = pendingSessions.get(senderJid);

    if (chatId !== pendingChatId) return false;

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const ms = parseTime(text.trim());

    if (!ms) {
        await sock.sendMessage(chatId, {
            text: '❌ Galat format! Sahi format: 10m, 1h, 30s\nDobara try karo.'
        }, { quoted: message });
        return true;
    }

    if (ms < 10000) {
        await sock.sendMessage(chatId, {
            text: '❌ Minimum 10 second ka time dalo.'
        }, { quoted: message });
        return true;
    }

    if (ms > 24 * 60 * 60 * 1000) {
        await sock.sendMessage(chatId, {
            text: '❌ Maximum 24 ghante ka time set kar sakte hain.'
        }, { quoted: message });
        return true;
    }

    pendingSessions.delete(senderJid);

    // If already a temp owner, clear existing timer
    if (activeTempOwners.has(targetJid)) {
        clearTimeout(activeTempOwners.get(targetJid).timer);
        activeTempOwners.delete(targetJid);
    }

    const ok = await addSudo(targetJid);
    if (!ok) {
        await sock.sendMessage(chatId, {
            text: '❌ Temp owner add karne mein error aya. Dobara try karo.'
        }, { quoted: message });
        return true;
    }

    const targetNum = targetJid.split('@')[0];
    const timeStr = formatTime(ms);
    const expiry = new Date(Date.now() + ms);
    const expiryStr = expiry.toLocaleString('ur-PK', { hour: '2-digit', minute: '2-digit', hour12: true });

    const timer = setTimeout(async () => {
        activeTempOwners.delete(targetJid);
        await removeSudo(targetJid);
        try {
            await sock.sendMessage(chatId, {
                text: `⌛ *Temporary Owner Expire*\n\n📱 *${targetNum}* ka temporary owner access khatam ho gaya!\n\nWaqt khatam: ${timeStr}`
            });
        } catch (_) {}
    }, ms);

    activeTempOwners.set(targetJid, { timer, expiry: expiry.getTime() });

    await sock.sendMessage(chatId, {
        text: `✅ *Temporary Owner Set!*\n\n📱 Number: *${targetNum}*\n⏱ Muddat: *${timeStr}*\n🕐 Expire hoga: *${expiryStr}*\n\n_Yeh waqt khatam hone par automatically remove ho jayega._`
    }, { quoted: message });

    return true;
}

function hasPendingSession(senderJid) {
    return pendingSessions.has(senderJid);
}

function getActiveTempOwners() {
    return activeTempOwners;
}

module.exports = {
    tempOwnerCommand,
    handleTempOwnerReply,
    hasPendingSession,
    getActiveTempOwners
};
