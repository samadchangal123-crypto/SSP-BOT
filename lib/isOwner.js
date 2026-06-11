const fs = require('fs');
const path = require('path');
const settings = require('../rdx-settings');
const { isSudo } = require('./index');

const SESSION_DIR = path.join(__dirname, '..', 'session');

// Resolve a LID number → phone number using session/lid-mapping-<lid>_reverse.json
function resolveLidToPhone(lidNumber) {
    if (!lidNumber) return null;
    try {
        const file = path.join(SESSION_DIR, `lid-mapping-${lidNumber}_reverse.json`);
        if (!fs.existsSync(file)) return null;
        const raw = fs.readFileSync(file, 'utf8').trim();
        // File contents look like: "923191852893"  (a JSON string)
        const parsed = JSON.parse(raw);
        return String(parsed).replace(/\D/g, '') || null;
    } catch {
        return null;
    }
}

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const ownerNumbers = Array.isArray(settings.ownerNumber)
        ? settings.ownerNumber
        : [settings.ownerNumber];

    const ownerNumberCleans = ownerNumbers.map(n => n.replace(/\D/g, ''));

    // Extract pure digits from senderId
    const senderClean = senderId.split(':')[0].split('@')[0].replace(/\D/g, '');
    const isLid = /@lid/i.test(senderId);

    console.log(`[isOwner] senderId="${senderId}" senderClean="${senderClean}" isLid=${isLid} owners=${JSON.stringify(ownerNumberCleans)}`);

    // --- Direct match ---
    if (ownerNumberCleans.includes(senderClean)) {
        console.log('[isOwner] ✅ Direct match');
        return true;
    }
    if (ownerNumberCleans.some(n => senderId.includes(n))) {
        console.log('[isOwner] ✅ Substring match');
        return true;
    }

    // --- LID → phone via on-disk mapping (works in private chat too) ---
    const mappedPhone = resolveLidToPhone(senderClean);
    if (mappedPhone) {
        console.log(`[isOwner] LID ${senderClean} → phone ${mappedPhone} (from lid-mapping file)`);
        if (ownerNumberCleans.includes(mappedPhone)) {
            console.log('[isOwner] ✅ LID match via session lid-mapping file');
            return true;
        }
    }

    // --- LID format: resolve via group metadata ---
    if (sock && chatId && chatId.endsWith('@g.us')) {
        try {
            const meta = await sock.groupMetadata(chatId);
            const participants = meta.participants || [];

            console.log(`[isOwner] Group participants count: ${participants.length}`);
            // Log first few for debugging
            participants.slice(0, 5).forEach(p => {
                console.log(`[isOwner]   p.id="${p.id}" p.lid="${p.lid || ''}" p.phoneNumber="${p.phoneNumber || ''}"`);
            });

            const found = participants.find(p => {
                const pId      = p.id  || '';
                const pLid     = p.lid || '';
                const pIdNum   = pId.split(':')[0].split('@')[0].replace(/\D/g, '');
                const pLidNum  = pLid.split(':')[0].split('@')[0].replace(/\D/g, '');
                return (
                    pId  === senderId ||
                    pLid === senderId ||
                    pIdNum  === senderClean ||
                    pLidNum === senderClean
                );
            });

            if (found) {
                const resolvedPhone = (found.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
                const phoneField    = (found.phoneNumber || '').replace(/\D/g, '');
                console.log(`[isOwner] LID resolved → id="${found.id}" resolvedPhone="${resolvedPhone}" phoneField="${phoneField}"`);

                if (resolvedPhone && ownerNumberCleans.includes(resolvedPhone)) {
                    console.log('[isOwner] ✅ LID match via id');
                    return true;
                }
                if (phoneField && ownerNumberCleans.includes(phoneField)) {
                    console.log('[isOwner] ✅ LID match via phoneNumber field');
                    return true;
                }
            } else {
                console.log(`[isOwner] ❌ No participant found for senderClean="${senderClean}"`);
            }
        } catch (e) {
            console.error('[isOwner] LID lookup error:', e.message);
        }
    }

    // --- Sudo check ---
    try {
        const sudo = await isSudo(senderId);
        console.log(`[isOwner] sudo check: ${sudo}`);
        return sudo;
    } catch (e) {
        return false;
    }
}

module.exports = isOwnerOrSudo;
