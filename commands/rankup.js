const fs    = require('fs');
const path  = require('path');
const axios = require('axios');
const sharp = require('sharp');

const DATA_FILE   = path.join(__dirname, '..', 'rdx-data', 'rankup.json');
const CACHE_DIR   = path.join(__dirname, '..', 'tmp', 'rankup');
const BG_URL      = 'https://i.ibb.co/V0G2znqL/4a0fa36ea3ce.jpg';
const BG_FILE     = path.join(CACHE_DIR, 'rankup_bg.jpg');
const FALLBACK_AV = path.join(__dirname, '..', 'assets', 'RDX1.jpg');

const XP_PER_MSG = 1;
const XP_PER_LVL = 15;
const MAX_LEVEL  = 10; // levels cycle 1..10, then restart at 1

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

function ensureDirs() {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
}

function loadData() {
    ensureDirs();
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return {}; }
}
function saveData(d) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); } catch {}
}

async function ensureBg() {
    ensureDirs();
    if (!fs.existsSync(BG_FILE)) {
        const res = await axios.get(BG_URL, { responseType: 'arraybuffer', timeout: 20000 });
        fs.writeFileSync(BG_FILE, Buffer.from(res.data));
    }
    return BG_FILE;
}

async function fetchAvatar(sock, userJid) {
    try {
        const url = await sock.profilePictureUrl(userJid, 'image');
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        return Buffer.from(res.data);
    } catch {
        try { return fs.readFileSync(FALLBACK_AV); } catch { return null; }
    }
}

function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]));
}

async function buildCard({ name, displayLevel, score, debug = false }) {
    const bgPath = await ensureBg();
    const bgMeta = await sharp(bgPath).metadata();
    const W = bgMeta.width  || 1024;
    const H = bgMeta.height || 683;

    const sx = W / 1024;
    const sy = H / 683;

    // === EDITABLE COORDS (in 1024x683 design space) ===
    // NAME box (silver rectangle area): change these to move name
    const NAME = { x: 232, y: 350, w: 580, h: 145, font: 40 };
    // LEVEL text (right card → centered over the rank panel)
    const LEVEL = { x: 180, y: 668, font: 45 };
    // SCORE text (right card → over "NEW RANK (Blank)")
    const SCORE = { x: 815, y: 460, font: 26 };
    // ===================================================

    const nameBoxX = NAME.x * sx, nameBoxY = NAME.y * sy;
    const nameBoxW = NAME.w * sx, nameBoxH = NAME.h * sy;
    const lvlX = LEVEL.x * sx, lvlY = LEVEL.y * sy;
    const scoreX = SCORE.x * sx, scoreY = SCORE.y * sy;

    // Preserve original characters/symbols (do NOT uppercase — that breaks decorative unicode/emoji)
    // Cap at 20 characters; longer names get an ellipsis.
    let rawName = (name || 'Unknown').toString().trim();
    if ([...rawName].length > 20) {
        rawName = [...rawName].slice(0, 20).join('') + '…';
    }
    const safeName = escapeXml(rawName);

    // Auto-fit: shrink font if the name is long so it stays inside the silver box.
    // Estimate text width (≈ 0.55 × fontSize per character for Sans fonts).
    let baseFont = NAME.font;
    const nameLen = [...rawName].length;
    const maxTextWidth = NAME.w - 20; // 10px padding each side
    const estWidthAtBase = nameLen * baseFont * 0.55;
    if (estWidthAtBase > maxTextWidth) {
        baseFont = Math.max(16, Math.floor(maxTextWidth / (nameLen * 0.55)));
    }

    const fontSize  = Math.round(baseFont * sx);
    const lvlFont   = Math.round(LEVEL.font * sx);
    const scoreFont = Math.round(SCORE.font * sx);

    // Fonts that cover Latin + decorative unicode + emoji (installed via Noto)
    const NAME_FONT_STACK  = '"Noto Sans","Noto Sans CJK SC","Noto Color Emoji","DejaVu Sans","Arial Black",sans-serif';
    const LABEL_FONT_STACK = '"Noto Sans","DejaVu Sans","Arial",sans-serif';
    // Digital LCD-style font (DSEG14 supports letters + digits in 14-segment look)
    const DIGITAL_FONT_STACK = '"DSEG14 Classic","DSEG7 Classic","DejaVu Sans Mono",monospace';

    // ---------- DEBUG OVERLAY (boxes, labels, grid) ----------
    let debugSvg = '';
    if (debug) {
        const gridStep = 50; // every 50px in design space
        let grid = '';
        for (let gx = 0; gx <= 1024; gx += gridStep) {
            const xx = gx * sx;
            grid += `<line x1="${xx}" y1="0" x2="${xx}" y2="${H}" stroke="#00ffff" stroke-width="0.5" opacity="0.35"/>`;
            grid += `<text x="${xx + 2}" y="12" font-family="Arial" font-size="${Math.round(10 * sx)}" fill="#00ffff" opacity="0.9">${gx}</text>`;
        }
        for (let gy = 0; gy <= 683; gy += gridStep) {
            const yy = gy * sy;
            grid += `<line x1="0" y1="${yy}" x2="${W}" y2="${yy}" stroke="#00ffff" stroke-width="0.5" opacity="0.35"/>`;
            grid += `<text x="2" y="${yy + 10}" font-family="Arial" font-size="${Math.round(10 * sx)}" fill="#00ffff" opacity="0.9">${gy}</text>`;
        }

        debugSvg = `
            ${grid}

            <!-- NAME box -->
            <rect x="${nameBoxX}" y="${nameBoxY}" width="${nameBoxW}" height="${nameBoxH}"
                  fill="rgba(255,255,0,0.12)" stroke="#ffff00" stroke-width="2" stroke-dasharray="6,4"/>
            <text x="${nameBoxX + 4}" y="${nameBoxY - 6}" font-family="Arial" font-weight="bold"
                  font-size="${Math.round(16 * sx)}" fill="#ffff00">
              NAME  x=${NAME.x} y=${NAME.y} w=${NAME.w} h=${NAME.h}
            </text>

            <!-- LEVEL anchor -->
            <circle cx="${lvlX}" cy="${lvlY}" r="6" fill="#55ff99" stroke="#000" stroke-width="1"/>
            <text x="${lvlX + 10}" y="${lvlY - 8}" font-family="Arial" font-weight="bold"
                  font-size="${Math.round(14 * sx)}" fill="#55ff99">
              LEVEL  x=${LEVEL.x} y=${LEVEL.y}
            </text>

            <!-- SCORE anchor -->
            <circle cx="${scoreX}" cy="${scoreY}" r="6" fill="#ff5555" stroke="#000" stroke-width="1"/>
            <text x="${scoreX + 10}" y="${scoreY + 18}" font-family="Arial" font-weight="bold"
                  font-size="${Math.round(14 * sx)}" fill="#ff5555">
              SCORE  x=${SCORE.x} y=${SCORE.y}
            </text>

            <!-- Legend -->
            <rect x="10" y="${H - 70}" width="${Math.round(360 * sx)}" height="60"
                  fill="rgba(0,0,0,0.55)" stroke="#fff" stroke-width="1"/>
            <text x="20" y="${H - 48}" font-family="Arial" font-weight="bold"
                  font-size="${Math.round(14 * sx)}" fill="#ffffff">DEBUG GRID (design 1024x683)</text>
            <text x="20" y="${H - 28}" font-family="Arial"
                  font-size="${Math.round(12 * sx)}" fill="#ffffff">
              Yellow = NAME box • Green = LEVEL • Red = SCORE
            </text>
            <text x="20" y="${H - 14}" font-family="Arial"
                  font-size="${Math.round(12 * sx)}" fill="#ffffff">
              x bayan(left) → daayan(right) • y oopar(top) → necy(bottom)
            </text>
        `;
    }
    // --------------------------------------------------------

    const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="thick"/>
          <feFlood flood-color="#ffb700" flood-opacity="0.95"/>
          <feComposite in2="thick" operator="in" result="edge"/>
          <feGaussianBlur in="edge" stdDeviation="3" result="g1"/>
          <feGaussianBlur in="edge" stdDeviation="8" result="g2"/>
          <feMerge>
            <feMergeNode in="g2"/>
            <feMergeNode in="g1"/>
            <feMergeNode in="edge"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#c0c0c0"/>
        </linearGradient>
        <linearGradient id="lvlGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#ffeaea"/>
          <stop offset="50%"  stop-color="#ff6a6a"/>
          <stop offset="100%" stop-color="#a30000"/>
        </linearGradient>
        <filter id="lvlGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="thick"/>
          <feFlood flood-color="#ff3b3b" flood-opacity="0.95"/>
          <feComposite in2="thick" operator="in" result="redEdge"/>
          <feGaussianBlur in="redEdge" stdDeviation="4" result="rb1"/>
          <feGaussianBlur in="redEdge" stdDeviation="9" result="rb2"/>
          <feMerge>
            <feMergeNode in="rb2"/>
            <feMergeNode in="rb1"/>
            <feMergeNode in="redEdge"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="digitalGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
        <filter id="digitalGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="thick"/>
          <feFlood flood-color="#ffb700" flood-opacity="0.95"/>
          <feComposite in2="thick" operator="in" result="edge"/>
          <feGaussianBlur in="edge" stdDeviation="3" result="g1"/>
          <feGaussianBlur in="edge" stdDeviation="8" result="g2"/>
          <feMerge>
            <feMergeNode in="g2"/>
            <feMergeNode in="g1"/>
            <feMergeNode in="edge"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      ${debugSvg}

      <text x="${nameBoxX + nameBoxW / 2}" y="${nameBoxY + nameBoxH / 2 + fontSize / 3}"
            text-anchor="middle"
            font-family='${NAME_FONT_STACK}' font-weight="bold"
            font-size="${fontSize}" fill="#ffffff" stroke="#ffffff" stroke-width="0.5"
            filter="url(#glow)">${safeName}</text>

      <text x="${lvlX}" y="${lvlY}"
            text-anchor="middle"
            font-family='${DIGITAL_FONT_STACK}' font-weight="bold"
            font-size="${lvlFont}"
            fill="#ffffff" stroke="#ffffff" stroke-width="0.5"
            letter-spacing="${Math.round(2 * sx)}"
            filter="url(#digitalGlow)">LEVEL ${String(displayLevel).padStart(2,'0')}</text>
    </svg>`;

    const composites = [{ input: Buffer.from(svg), top: 0, left: 0 }];

    return await sharp(bgPath).composite(composites).jpeg({ quality: 92 }).toBuffer();
}

/**
 * Increment XP for a user in a chat. Returns { leveledUp, oldLevel, newLevel, xp }.
 */
function incrementXp(chatId, senderId) {
    if (!chatId || !senderId) return null;
    const data = loadData();
    if (!data[chatId]) data[chatId] = {};
    const u = data[chatId][senderId] || { xp: 0, level: 0 };
    const oldLevel = Math.floor(u.xp / XP_PER_LVL);
    u.xp = (u.xp || 0) + XP_PER_MSG;
    const newLevel = Math.floor(u.xp / XP_PER_LVL);
    u.level = newLevel;
    data[chatId][senderId] = u;
    saveData(data);
    return { leveledUp: newLevel > oldLevel, oldLevel, newLevel, xp: u.xp };
}

function getUserStats(chatId, senderId) {
    const data = loadData();
    const u = data?.[chatId]?.[senderId] || { xp: 0, level: 0 };
    const xp = u.xp || 0;
    const totalLevels = Math.floor(xp / XP_PER_LVL);              // 0,1,2,3...
    const displayLevel = (totalLevels % MAX_LEVEL) + 1;           // cycles 1..10
    const score = xp % XP_PER_LVL;                                // 0..14 within current level
    return { xp, totalLevels, displayLevel, score };
}

async function rankupCommand(sock, chatId, message, senderId, args = '') {
    try {
        const { displayLevel, score } = getUserStats(chatId, senderId);

        // Resolve display name (fallback to number)
        let name = 'User';
        try {
            name = message.pushName || senderId.split('@')[0];
        } catch { name = senderId.split('@')[0]; }

        const debug = /\b(debug|grid|highlight|highlights)\b/i.test(args || '');
        const cardBuf = await buildCard({ name, displayLevel, score, debug });

        const caption =
`╭━━━━━━━━━━━━━━━━╮
┃ 🎖️ *RANK-UP  CARD*
╰━━━━━━━━━━━━━━━━╯
👤 *Name  :* ${name}
🏆 *Level :* ${displayLevel}/${MAX_LEVEL}
✨ *Score :* ${score}/${XP_PER_LVL}

🤖 _Powered by RDX BOT BOT_`;

        await sock.sendMessage(chatId, {
            image: cardBuf,
            caption,
            ...channelContext
        }, { quoted: message });
    } catch (err) {
        console.error('[rankup] error:', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Rankup card generate nahi ho saka. Thori der baad try karo.'
        }, { quoted: message });
    }
}

async function announceLevelUp(sock, chatId, message, senderId) {
    try {
        const { displayLevel, score } = getUserStats(chatId, senderId);

        let name = 'User';
        try {
            name = message.pushName || senderId.split('@')[0];
        } catch { name = senderId.split('@')[0]; }

        const cardBuf = await buildCard({ name, displayLevel, score });

        const caption =
`╔═════════════════╗
   🎊 *LEVEL UP NOTICE* 🎊
╚═════════════════╝

✨ *Congratulations* @${senderId.split('@')[0]}
🏆 *New Level :* ${displayLevel}/${MAX_LEVEL}
✨ *Score :* ${score}/${XP_PER_LVL}

🤖 _Powered by RDX BOT BOT_`;

        await sock.sendMessage(chatId, {
            image: cardBuf,
            caption,
            mentions: [senderId],
            ...channelContext
        });
    } catch (err) {
        console.error('[rankup] level-up error:', err.message);
    }
}

module.exports = {
    rankupCommand,
    incrementXp,
    announceLevelUp,
    getUserStats,
};
