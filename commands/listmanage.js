const isOwnerOrSudo = require('../lib/isOwner');
const store = require('../lib/lightweight_store');

const SESSION_TTL_MS = 5 * 60 * 1000;

const pendingSessions = new Map();

function setSession(senderJid, data) {
    pendingSessions.set(senderJid, { ...data, createdAt: Date.now() });
}

function getSession(senderJid) {
    const s = pendingSessions.get(senderJid);
    if (!s) return null;
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
        pendingSessions.delete(senderJid);
        return null;
    }
    return s;
}

function clearSession(senderJid) {
    pendingSessions.delete(senderJid);
}

function hasPendingListSession(senderJid) {
    return !!getSession(senderJid);
}

function parseSelection(text, max) {
    const cleaned = String(text || '').trim().toLowerCase();
    if (!cleaned) return null;
    if (cleaned === 'all') {
        return Array.from({ length: max }, (_, i) => i + 1);
    }
    if (cleaned === 'cancel' || cleaned === 'exit' || cleaned === 'stop') {
        return 'cancel';
    }
    const parts = cleaned.split(/[\s,]+/).filter(Boolean);
    const nums = [];
    for (const p of parts) {
        if (!/^\d+$/.test(p)) return null;
        const n = parseInt(p, 10);
        if (n < 1 || n > max) return null;
        if (!nums.includes(n)) nums.push(n);
    }
    return nums.length ? nums : null;
}

async function ensureOwner(sock, chatId, message) {
    const senderJid = message.key.participant || message.key.remoteJid;
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderJid, sock, chatId);
    if (!isOwner) {
        await sock.sendMessage(chatId, {
            text: '❌ Yeh command sirf owner/sudo use kar sakte hain.'
        }, { quoted: message });
        return null;
    }
    return senderJid;
}

async function fetchGroups(sock) {
    try {
        const all = await sock.groupFetchAllParticipating();
        return Object.values(all).map(g => ({
            jid: g.id,
            name: g.subject || 'Unknown Group',
            size: g.participants ? g.participants.length : 0
        })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error('[listmanage] groupFetchAllParticipating error:', e.message);
        return [];
    }
}

function fetchChannels() {
    const found = new Map();
    const collect = (id) => {
        if (typeof id === 'string' && id.endsWith('@newsletter')) {
            if (!found.has(id)) found.set(id, { jid: id, name: '' });
        }
    };
    try {
        Object.keys(store.chats || {}).forEach(id => {
            collect(id);
            if (found.has(id)) {
                const subject = store.chats[id]?.subject;
                if (subject) found.get(id).name = subject;
            }
        });
        Object.keys(store.messages || {}).forEach(collect);
        Object.keys(store.contacts || {}).forEach(id => {
            collect(id);
            if (found.has(id)) {
                const name = store.contacts[id]?.name;
                if (name && !found.get(id).name) found.get(id).name = name;
            }
        });
    } catch (_) {}
    return Array.from(found.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

async function gclistCommand(sock, chatId, message) {
    const senderJid = await ensureOwner(sock, chatId, message);
    if (!senderJid) return;

    await sock.sendMessage(chatId, { text: '⏳ Groups fetch ho rahe hain, link bhi nikal raha hoon...' }, { quoted: message });

    const groups = await fetchGroups(sock);
    if (!groups.length) {
        await sock.sendMessage(chatId, { text: '📭 Bot kisi group mein nahi hai.' }, { quoted: message });
        return;
    }

    const lines = [`╭━━━ 📋 *GROUP LIST* (${groups.length}) ━━━╮`];
    let idx = 1;
    for (const g of groups) {
        let link = '';
        try {
            const code = await sock.groupInviteCode(g.jid);
            if (code) link = `https://chat.whatsapp.com/${code}`;
        } catch (_) {
            link = '_(bot admin nahi / link unavailable)_';
        }
        lines.push(`\n*${idx}.* ${g.name}\n   👥 ${g.size} members\n   🔗 ${link || '_unavailable_'}`);
        idx++;
    }
    lines.push('\n╰━━━━━━━━━━━━━━━━━━━━━━╯');

    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
}

async function chlistCommand(sock, chatId, message) {
    const senderJid = await ensureOwner(sock, chatId, message);
    if (!senderJid) return;

    await sock.sendMessage(chatId, { text: '⏳ Channels list bana raha hoon...' }, { quoted: message });

    const channels = fetchChannels();
    if (!channels.length) {
        await sock.sendMessage(chatId, {
            text: '📭 Koi channel nahi mila.\n_(Bot ne ab tak jin channels se messages dekhe woh hi list ho sakte hain. Channel khol kar dobara try karein.)_'
        }, { quoted: message });
        return;
    }

    const lines = [`╭━━━ 📢 *CHANNEL LIST* (${channels.length}) ━━━╮`];
    let idx = 1;
    for (const c of channels) {
        let name = c.name || 'Unknown Channel';
        let invite = '';
        try {
            const meta = await sock.newsletterMetadata('jid', c.jid);
            if (meta) {
                if (meta.name) name = meta.name;
                if (meta.invite) invite = `https://whatsapp.com/channel/${meta.invite}`;
            }
        } catch (_) {}
        lines.push(`\n*${idx}.* ${name}\n   🆔 ${c.jid}\n   🔗 ${invite || '_unavailable_'}`);
        idx++;
    }
    lines.push('\n╰━━━━━━━━━━━━━━━━━━━━━━╯');

    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
}

async function joinCommand(sock, chatId, message) {
    const senderJid = await ensureOwner(sock, chatId, message);
    if (!senderJid) return;

    const groups = await fetchGroups(sock);
    if (!groups.length) {
        await sock.sendMessage(chatId, { text: '📭 Bot kisi group mein nahi hai.' }, { quoted: message });
        return;
    }

    const lines = [`╭━━━ ➕ *JOIN — GROUP CHOOSE KAREN* ━━━╮`];
    groups.forEach((g, i) => {
        lines.push(`\n*${i + 1}.* ${g.name}  _(${g.size})_`);
    });
    lines.push('\n╰━━━━━━━━━━━━━━━━━━━━━━╯');
    lines.push(`\n📝 Number reply karein (multi: *1,2,8* — sab ke liye *all* — band karne ke liye *cancel*).`);
    lines.push(`⏱ 5 minute ke andar reply karein.`);

    setSession(senderJid, { mode: 'join', list: groups, chatId });

    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
}

async function outboxCommand(sock, chatId, message) {
    const senderJid = await ensureOwner(sock, chatId, message);
    if (!senderJid) return;

    const groups = await fetchGroups(sock);
    if (!groups.length) {
        await sock.sendMessage(chatId, { text: '📭 Bot kisi group mein nahi hai.' }, { quoted: message });
        return;
    }

    const lines = [`╭━━━ 🚪 *OUTBOX — LEAVE GROUPS* ━━━╮`];
    groups.forEach((g, i) => {
        lines.push(`\n*${i + 1}.* ${g.name}  _(${g.size})_`);
    });
    lines.push('\n╰━━━━━━━━━━━━━━━━━━━━━━╯');
    lines.push(`\n📝 Number reply karein (multi: *1,2,8* — sab ke liye *all* — band karne ke liye *cancel*).`);
    lines.push(`⏱ 5 minute ke andar reply karein.`);

    setSession(senderJid, { mode: 'outbox', list: groups, chatId });

    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
}

async function handleListSelection(sock, chatId, message) {
    const senderJid = message.key.participant || message.key.remoteJid;
    const session = getSession(senderJid);
    if (!session) return false;
    if (session.chatId !== chatId) return false;

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const selection = parseSelection(text, session.list.length);

    if (selection === 'cancel') {
        clearSession(senderJid);
        await sock.sendMessage(chatId, { text: '❎ Cancel ho gaya.' }, { quoted: message });
        return true;
    }
    if (!selection) return false;

    clearSession(senderJid);

    const targets = selection.map(n => session.list[n - 1]);

    if (session.mode === 'join') {
        const userJid = senderJid;
        const userNum = userJid.split('@')[0];
        const results = [];
        for (const g of targets) {
            try {
                const res = await sock.groupParticipantsUpdate(g.jid, [userJid], 'add');
                const status = Array.isArray(res) && res[0] ? String(res[0].status) : 'unknown';
                if (status === '200' || status === 200) {
                    results.push(`✅ *${g.name}* — add ho gaye`);
                } else if (status === '403') {
                    let invite = '';
                    try {
                        const code = await sock.groupInviteCode(g.jid);
                        if (code) invite = `\n   🔗 https://chat.whatsapp.com/${code}`;
                    } catch (_) {}
                    results.push(`⚠️ *${g.name}* — privacy ki wajah se add nahi hua, link use karein${invite}`);
                } else if (status === '408') {
                    results.push(`⌛ *${g.name}* — user ne abhi recently leave kiya tha, thori der baad try karein`);
                } else if (status === '409') {
                    results.push(`ℹ️ *${g.name}* — pehle se group mein hain`);
                } else if (status === '401') {
                    results.push(`🚫 *${g.name}* — group se ban hain`);
                } else {
                    results.push(`❌ *${g.name}* — failed (status ${status})`);
                }
            } catch (e) {
                results.push(`❌ *${g.name}* — error: ${e.message}`);
            }
        }
        await sock.sendMessage(chatId, {
            text: `╭━━━ ➕ *JOIN RESULT* ━━━╮\n👤 User: ${userNum}\n\n${results.join('\n')}\n╰━━━━━━━━━━━━━━━━━━╯`
        }, { quoted: message });
        return true;
    }

    if (session.mode === 'outbox') {
        const results = [];
        for (const g of targets) {
            try {
                await sock.groupLeave(g.jid);
                results.push(`✅ *${g.name}* — left`);
            } catch (e) {
                results.push(`❌ *${g.name}* — error: ${e.message}`);
            }
        }
        await sock.sendMessage(chatId, {
            text: `╭━━━ 🚪 *OUTBOX RESULT* ━━━╮\n\n${results.join('\n')}\n╰━━━━━━━━━━━━━━━━━━╯`
        }, { quoted: message });
        return true;
    }

    return false;
}

module.exports = {
    gclistCommand,
    chlistCommand,
    joinCommand,
    outboxCommand,
    handleListSelection,
    hasPendingListSession
};
