/**
 * ╔══════════════════════════════════╗
 * ║   RDX BOT — Islamic Scheduler   ║
 * ║  Hourly Islamic Messages (PKT)  ║
 * ║  Auto-send to All Groups        ║
 * ╚══════════════════════════════════╝
 */

const cron = require('node-cron');
const moment = require('moment-timezone');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ─── Approved Groups Store ─────────────────────────────────────
const APPROVED_FILE = path.join(__dirname, '..', 'data', 'islamic-approved-groups.json');

function loadApprovedGroups() {
    try {
        if (!fs.existsSync(APPROVED_FILE)) return [];
        const raw = fs.readFileSync(APPROVED_FILE, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('[Islamic] loadApprovedGroups error:', err.message);
        return [];
    }
}

function saveApprovedGroups(list) {
    try {
        const dir = path.dirname(APPROVED_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(APPROVED_FILE, JSON.stringify(list, null, 2));
        return true;
    } catch (err) {
        console.error('[Islamic] saveApprovedGroups error:', err.message);
        return false;
    }
}

function isGroupApproved(jid) {
    return loadApprovedGroups().includes(jid);
}

function approveGroup(jid) {
    const list = loadApprovedGroups();
    if (list.includes(jid)) return false;
    list.push(jid);
    return saveApprovedGroups(list);
}

function disapproveGroup(jid) {
    const list = loadApprovedGroups();
    const filtered = list.filter(g => g !== jid);
    if (filtered.length === list.length) return false;
    return saveApprovedGroups(filtered);
}

// ─── Single bot picture used everywhere ───────────────────────
const BOT_PIC = path.join(__dirname, '..', 'assets', 'RDX1.jpg');
const quranPics = [BOT_PIC];
const namazPics = [BOT_PIC];

// ─── Quran Ayats (Arabic + Urdu) ──────────────────────────────
const quranAyats = [
    {
        arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        urdu: "اللہ کے نام سے جو بڑا مہربان، نہایت رحم والا ہے",
        surah: "سورۃ الفاتحہ — آیت ۱"
    },
    {
        arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
        urdu: "بیشک مشکل کے ساتھ آسانی ہے",
        surah: "سورۃ الشرح — آیت ۶"
    },
    {
        arabic: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
        urdu: "اور جو اللہ پر توکل کرے تو وہ اسے کافی ہے",
        surah: "سورۃ الطلاق — آیت ۳"
    },
    {
        arabic: "فَاذْكُرُونِي أَذْكُرْكُمْ",
        urdu: "پس تم مجھے یاد کرو، میں تمہیں یاد کروں گا",
        surah: "سورۃ البقرہ — آیت ۱۵۲"
    },
    {
        arabic: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
        urdu: "بیشک اللہ صبر کرنے والوں کے ساتھ ہے",
        surah: "سورۃ البقرہ — آیت ۱۵۳"
    },
    {
        arabic: "وَلَا تَيَأَسُوا مِن رَّوْحِ اللَّهِ",
        urdu: "اور اللہ کی رحمت سے مایوس مت ہو",
        surah: "سورۃ یوسف — آیت ۸۷"
    },
    {
        arabic: "رَبِّ اشْرَحْ لِي صَدْرِي",
        urdu: "اے میرے رب! میرا سینہ کھول دے",
        surah: "سورۃ طٰہٰ — آیت ۲۵"
    },
    {
        arabic: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
        urdu: "اللہ ہمیں کافی ہے اور وہ بہترین کارساز ہے",
        surah: "سورۃ آل عمران — آیت ۱۷۳"
    },
    {
        arabic: "وَقُل رَّبِّ زِدْنِي عِلْمًا",
        urdu: "اور کہو: اے میرے رب! میرے علم میں اضافہ فرما",
        surah: "سورۃ طٰہٰ — آیت ۱۱۴"
    },
    {
        arabic: "إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ",
        urdu: "بیشک اللہ نیکی کرنے والوں کا اجر ضائع نہیں کرتا",
        surah: "سورۃ یوسف — آیت ۹۰"
    },
    {
        arabic: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ",
        urdu: "اور وہ تمہارے ساتھ ہے جہاں بھی تم ہو",
        surah: "سورۃ الحدید — آیت ۴"
    },
    {
        arabic: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
        urdu: "اللہ کسی جان پر اس کی طاقت سے زیادہ بوجھ نہیں ڈالتا",
        surah: "سورۃ البقرہ — آیت ۲۸۶"
    },
    {
        arabic: "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ",
        urdu: "جب میرے بندے میرے بارے میں پوچھیں تو میں قریب ہوں",
        surah: "سورۃ البقرہ — آیت ۱۸۶"
    },
    {
        arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً",
        urdu: "اے ہمارے رب! دنیا میں بھی بھلائی دے اور آخرت میں بھی",
        surah: "سورۃ البقرہ — آیت ۲۰۱"
    },
    {
        arabic: "وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ",
        urdu: "صبر کرو، تمہارا صبر اللہ ہی کی توفیق سے ہے",
        surah: "سورۃ النحل — آیت ۱۲۷"
    }
];

// ─── Ahadith (Urdu) ───────────────────────────────────────────
const ahadith = [
    { text: "جو شخص کسی مسلمان کی کوئی دنیاوی تکلیف دور کرے، اللہ اس کی آخرت کی تکلیف دور فرمائے گا۔", ref: "صحیح مسلم" },
    { text: "مسکرانا بھی صدقہ ہے۔", ref: "صحیح بخاری" },
    { text: "سب سے بہتر وہ شخص ہے جو لوگوں کو سب سے زیادہ فائدہ پہنچائے۔", ref: "السلسلۃ الصحیحہ" },
    { text: "جو شخص اللہ پر اور قیامت کے دن پر ایمان رکھتا ہو، وہ اچھی بات کہے یا خاموش رہے۔", ref: "صحیح بخاری" },
    { text: "سچائی نیکی کی طرف لے جاتی ہے اور نیکی جنت کی طرف۔", ref: "صحیح بخاری" },
    { text: "جو شخص اللہ سے نہیں مانگتا، اللہ اس سے ناراض ہوتا ہے۔", ref: "ترمذی" },
    { text: "ماں کے قدموں تلے جنت ہے۔", ref: "نسائی" },
    { text: "آپس میں سلام کو عام کرو، ایک دوسرے کو کھانا کھلاؤ، رشتے جوڑو — جنت میں سلامتی سے داخل ہوگے۔", ref: "ترمذی" },
    { text: "مومن کے لیے عجیب بات ہے — اس کا سارا معاملہ اس کے لیے خیر ہے۔ خوشی ہو تو شکر کرے، تکلیف ہو تو صبر کرے۔", ref: "صحیح مسلم" },
    { text: "جو شخص لوگوں کا شکریہ ادا نہیں کرتا وہ اللہ کا بھی شکریہ ادا نہیں کرتا۔", ref: "ابو داود" }
];

// ─── Dhikr Messages (Urdu) ────────────────────────────────────
const dhikrMessages = [
    { dhikr: "سُبْحَانَ اللهِ وَبِحَمْدِهِ", count: "۱۰۰ بار", faida: "گناہ معاف ہو جاتے ہیں چاہے سمندر کی جھاگ کے برابر ہوں" },
    { dhikr: "لَا إِلٰهَ إِلَّا اللّٰهُ", count: "۱۰۰ بار", faida: "۱۰۰ نیکیاں ملتی ہیں اور ۱۰۰ گناہ معاف ہوتے ہیں" },
    { dhikr: "أَسْتَغْفِرُ اللّٰهَ", count: "۱۰۰ بار", faida: "اللہ تعالیٰ ہر تنگی سے نجات دیتا ہے" },
    { dhikr: "اَللّٰهُ أَكْبَرُ", count: "۳۳ بار", faida: "نیکیوں کا خزانہ — نماز کے بعد ضرور پڑھیں" },
    { dhikr: "دُرُودِ اِبراہیم", count: "۱۰ بار", faida: "اللہ ۱۰ رحمتیں نازل فرماتا ہے" },
    { dhikr: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيمِ", count: "ہر کام سے پہلے", faida: "ہر کام میں برکت آتی ہے" },
    { dhikr: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ", count: "بار بار پڑھیں", faida: "جنت کے خزانوں میں سے ایک خزانہ" }
];

// ─── Morning Messages (Urdu) ──────────────────────────────────
const morningMessages = [
    "صبح بخیر! نئے دن کا آغاز اللہ کے ذکر سے کریں۔\n\n*صبح کی دعا:*\n❝ أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلّٰهِ ❞\n\nہم نے صبح کی اور اللہ ہی کی بادشاہی کے ساتھ صبح کی، ساری تعریف اللہ کے لیے ہے۔",
    "خوبصورت صبح! اللہ نے ایک اور دن عطا کیا — اس کا شکر ادا کریں!\n\nاَلْحَمْدُ لِلّٰهِ عَلٰی نِعْمَةِ الْاِسْلَامِ\n_اسلام کی نعمت پر اللہ کا شکر_\n\nآج کا دن نیک نیت سے شروع کریں 💚",
    "صبح بخیر! اللہ آپ کے دن کو خیر و برکت سے بھرے!\n\n*آج کا عمل:* فجر کی نماز باجماعت ادا کریں\n🌟 فجر کی دو رکعت دنیا اور اس میں جو کچھ ہے اس سے بہتر ہے",
];

// ─── Night Messages (Urdu) ────────────────────────────────────
const nightMessages = [
    "شب بخیر! سونے سے پہلے کی دعا:\n\n❝ بِاسْمِكَ اللّٰهُمَّ أَمُوتُ وَأَحْيَا ❞\n\nاے اللہ! تیرے نام کے ساتھ مرتا ہوں اور تیرے نام کے ساتھ جیتا ہوں\n\n💤 سوتے وقت آیت الکرسی ضرور پڑھیں",
    "رات کا ذکر — سونے سے پہلے پڑھیں:\n\n• سورۃ الاخلاص (۳ بار)\n• سورۃ الفلق (۳ بار)\n• سورۃ الناس (۳ بار)\n\nیہ پڑھ کر دونوں ہاتھ جسم پر پھیلائیں — حفاظتِ الٰہی میں ہوں گے 🤲",
    "تہجد کی یاد دہانی!\n\nرات کی آخری تہائی میں اللہ پکارتا ہے:\n\n❝ ہے کوئی مانگنے والا جسے میں دوں؟ ہے کوئی بخشش مانگنے والا جسے میں بخشوں؟ ❞\n\n🤲 تہجد پڑھیں — دعا قبول ہوتی ہے",
];

// ─── Build messages ────────────────────────────────────────────
function timeStamp() {
    const time = moment().tz('Asia/Karachi').format('hh:mm A');
    const date = moment().tz('Asia/Karachi').format('DD MMM YYYY');
    return `🕌 *RDX BOT* | 🇵🇰 ${time} PKT\n📅 ${date}`;
}

function buildQuranMsg(ayat) {
    return `┏━━━━━━━━━━━━━━━━━━━┓
┃   📖 *قرآنِ پاک کی آیت*   ┃
┗━━━━━━━━━━━━━━━━━━━┛

*❝ ${ayat.arabic} ❞*

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

📝 *ترجمہ:*
_${ayat.urdu}_

📍 *${ayat.surah}*

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${timeStamp()}`.trim();
}

function buildHadithMsg(h) {
    return `┏━━━━━━━━━━━━━━━━━━━┓
┃   📚 *حدیثِ مبارک*   ┃
┗━━━━━━━━━━━━━━━━━━━┛

🌸 *رسول اللہ ﷺ نے فرمایا:*

❝ ${h.text} ❞

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

📖 *حوالہ:* ${h.ref}

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${timeStamp()}`.trim();
}

function buildDhikrMsg(d) {
    return `┏━━━━━━━━━━━━━━━━━━━┓
┃   📿 *ذکر کی یاد دہانی*   ┃
┗━━━━━━━━━━━━━━━━━━━┛

✨ *ابھی پڑھیں:*

❝ ${d.dhikr} ❞

🔢 *تعداد:* ${d.count}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

💎 *فائدہ:*
_${d.faida}_

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${timeStamp()}`.trim();
}

function buildMorningMsg(m) {
    return `┏━━━━━━━━━━━━━━━━━━━┓
┃   🌅 *صبح کا پیغام*   ┃
┗━━━━━━━━━━━━━━━━━━━┛

${m}

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${timeStamp()}`.trim();
}

function buildNightMsg(n) {
    return `┏━━━━━━━━━━━━━━━━━━━┓
┃   🌙 *رات کا پیغام*   ┃
┗━━━━━━━━━━━━━━━━━━━┛

${n}

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${timeStamp()}`.trim();
}

function buildTahajjudMsg() {
    return `┏━━━━━━━━━━━━━━━━━━━┓
┃   🌟 *تہجد کا وقت*   ┃
┗━━━━━━━━━━━━━━━━━━━┛

🌙 *اٹھیں — یہ قبولیت کا وقت ہے!*

❝ ہمارا رب ہر رات آسمانِ دنیا پر نازل ہوتا ہے ❞

_اور پکارتا ہے:_
_"ہے کوئی دعا مانگنے والا؟ ہے کوئی بخشش مانگنے والا؟"_

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

🤲 *ابھی اٹھیں اور ۲ رکعت تہجد پڑھیں*
💫 پھر دل سے دعا مانگیں — ضرور قبول ہوگی

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${timeStamp()}`.trim();
}

function buildNamazMsg(namazName) {
    const namazUrdu = { Fajr: 'فجر', Dhuhr: 'ظہر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشاء' };
    const emojis = { Fajr: '🌅', Dhuhr: '☀️', Asr: '🌤️', Maghrib: '🌇', Isha: '🌙' };
    const emoji = emojis[namazName] || '🕌';
    const urduName = namazUrdu[namazName] || namazName;
    return `┏━━━━━━━━━━━━━━━━━━━┓
┃   🕌 *نماز الرٹ*   ┃
┗━━━━━━━━━━━━━━━━━━━┛

${emoji} *${urduName} کی نماز کا وقت ہو گیا!*

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

❝ إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا ❞

_بیشک نماز مومنوں پر وقتِ مقررہ پر فرض ہے_

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

🤲 *ابھی وضو کریں اور نماز ادا کریں*
🔑 نماز — جنت کی چابی

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
${timeStamp()}`.trim();
}

// ─── Hour-based content selector ──────────────────────────────
function getHourlyContent(hour) {
    if (hour >= 3 && hour <= 5) {
        return { type: 'tahajjud', pics: namazPics, msg: buildTahajjudMsg() };
    }
    if (hour >= 6 && hour <= 9) {
        const m = morningMessages[Math.floor(Math.random() * morningMessages.length)];
        return { type: 'morning', pics: quranPics, msg: buildMorningMsg(m) };
    }
    if (hour >= 10 && hour <= 11) {
        const h = ahadith[Math.floor(Math.random() * ahadith.length)];
        return { type: 'hadith', pics: quranPics, msg: buildHadithMsg(h) };
    }
    if (hour >= 12 && hour <= 14) {
        const a = quranAyats[Math.floor(Math.random() * quranAyats.length)];
        return { type: 'quran', pics: quranPics, msg: buildQuranMsg(a) };
    }
    if (hour >= 15 && hour <= 16) {
        const d = dhikrMessages[Math.floor(Math.random() * dhikrMessages.length)];
        return { type: 'dhikr', pics: quranPics, msg: buildDhikrMsg(d) };
    }
    if (hour >= 17 && hour <= 19) {
        const a = quranAyats[Math.floor(Math.random() * quranAyats.length)];
        return { type: 'quran', pics: quranPics, msg: buildQuranMsg(a) };
    }
    if (hour >= 20 && hour <= 21) {
        const h = ahadith[Math.floor(Math.random() * ahadith.length)];
        return { type: 'hadith', pics: quranPics, msg: buildHadithMsg(h) };
    }
    if (hour >= 22 || hour === 0) {
        const n = nightMessages[Math.floor(Math.random() * nightMessages.length)];
        return { type: 'night', pics: namazPics, msg: buildNightMsg(n) };
    }
    if (hour >= 1 && hour <= 2) {
        const d = dhikrMessages[Math.floor(Math.random() * dhikrMessages.length)];
        return { type: 'dhikr', pics: quranPics, msg: buildDhikrMsg(d) };
    }
    const a = quranAyats[Math.floor(Math.random() * quranAyats.length)];
    return { type: 'quran', pics: quranPics, msg: buildQuranMsg(a) };
}

// ─── Core helpers ──────────────────────────────────────────────
let sock = null;
let scheduledTasks = [];
let isInitialized = false;

async function getAllGroupJids() {
    try {
        const groups = await sock.groupFetchAllParticipating();
        const allJids = Object.keys(groups);
        const approved = loadApprovedGroups();
        // Only return groups that are explicitly approved
        return allJids.filter(jid => approved.includes(jid));
    } catch (err) {
        console.error('[Islamic] Could not fetch groups:', err.message);
        return [];
    }
}

async function getImageBuffer(urlOrPath) {
    try {
        if (urlOrPath && !/^https?:\/\//i.test(urlOrPath) && fs.existsSync(urlOrPath)) {
            return fs.readFileSync(urlOrPath);
        }
        const res = await axios.get(urlOrPath, { responseType: 'arraybuffer', timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        return Buffer.from(res.data);
    } catch { return null; }
}

async function sendToAllGroups(caption, picUrls) {
    if (!sock) return;
    const groups = await getAllGroupJids();
    if (groups.length === 0) { console.log('[Islamic] No groups found'); return; }

    const randomPic = picUrls[Math.floor(Math.random() * picUrls.length)];
    const imgBuffer = await getImageBuffer(randomPic);

    let sent = 0;
    for (const jid of groups) {
        try {
            if (imgBuffer) {
                await sock.sendMessage(jid, { image: imgBuffer, caption, mimetype: 'image/jpeg' });
            } else {
                await sock.sendMessage(jid, { text: caption });
            }
            sent++;
            await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
            console.error(`[Islamic] Failed ${jid}:`, err.message);
        }
    }
    console.log(`[Islamic] Sent to ${sent}/${groups.length} groups`);
}

// ─── Senders ───────────────────────────────────────────────────
async function sendHourlyMessage() {
    try {
        const hour = moment().tz('Asia/Karachi').hour();
        const content = getHourlyContent(hour);
        console.log(`[Islamic] Hourly msg (type: ${content.type}, hour: ${hour} PKT)`);
        await sendToAllGroups(content.msg, content.pics);
    } catch (err) {
        console.error('[Islamic] sendHourlyMessage error:', err.message);
    }
}

async function sendNamazAlert(namazName) {
    try {
        console.log(`[Islamic] Sending ${namazName} Namaz Alert...`);
        await sendToAllGroups(buildNamazMsg(namazName), namazPics);
    } catch (err) {
        console.error(`[Islamic] sendNamazAlert (${namazName}) error:`, err.message);
    }
}

// ─── Schedulers ───────────────────────────────────────────────
function stopIslamicSchedulers() {
    for (const task of scheduledTasks) { try { task.stop(); } catch { } }
    scheduledTasks = [];
    console.log('[Islamic] All schedulers stopped');
}

function startIslamicSchedulers() {
    stopIslamicSchedulers();
    const tz = 'Asia/Karachi';

    scheduledTasks.push(cron.schedule('0 * * * *', () => sendHourlyMessage(), { timezone: tz }));
    scheduledTasks.push(cron.schedule('43 5 * * *', () => sendNamazAlert('Fajr'), { timezone: tz }));
    scheduledTasks.push(cron.schedule('23 12 * * *', () => sendNamazAlert('Dhuhr'), { timezone: tz }));
    scheduledTasks.push(cron.schedule('7 16 * * *', () => sendNamazAlert('Asr'), { timezone: tz }));
    scheduledTasks.push(cron.schedule('43 17 * * *', () => sendNamazAlert('Maghrib'), { timezone: tz }));
    scheduledTasks.push(cron.schedule('4 19 * * *', () => sendNamazAlert('Isha'), { timezone: tz }));

    console.log('[Islamic] Hourly Islamic Messages + 5 Namaz Alerts active — PKT timezone');
}

function initIslamicScheduler(botSock) {
    sock = botSock;
    if (!isInitialized) { startIslamicSchedulers(); isInitialized = true; }
}

function reinitIslamicScheduler(botSock) {
    sock = botSock;
    if (!isInitialized) { startIslamicSchedulers(); isInitialized = true; }
}

// ─── Islamic Approve/Disapprove Command ───────────────────────
async function handleIslamicCommand(sock, chatId, userMessage, senderId, isSenderAdmin, isGroup, message) {
    try {
        const args = userMessage.trim().split(/\s+/).slice(1);
        const action = (args[0] || '').toLowerCase();

        const usage = `┏━━━━━━━━━━━━━━━━━━━┓
┃ 🕌 *ISLAMIC SCHEDULER* ┃
┗━━━━━━━━━━━━━━━━━━━┛

*.islamic approve* — اس گروپ میں hourly + namaz پیغامات شروع کریں
*.islamic disapprove* — اس گروپ میں پیغامات بند کریں
*.islamic status* — اس گروپ کی موجودہ حالت
*.islamic list* — تمام approved گروپس`;

        if (!action) {
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        if (action === 'list') {
            const list = loadApprovedGroups();
            if (list.length === 0) {
                await sock.sendMessage(chatId, { text: '*_No groups are approved yet._*' }, { quoted: message });
                return;
            }
            let txt = `*✅ Approved Groups (${list.length}):*\n\n`;
            for (let i = 0; i < list.length; i++) {
                let name = list[i];
                try {
                    const meta = await sock.groupMetadata(list[i]);
                    name = `${meta.subject}  \`${list[i]}\``;
                } catch { }
                txt += `${i + 1}. ${name}\n`;
            }
            await sock.sendMessage(chatId, { text: txt.trim() }, { quoted: message });
            return;
        }

        if (!isGroup) {
            await sock.sendMessage(chatId, { text: '*_This command can only be used in groups._*' }, { quoted: message });
            return;
        }

        if (action === 'status') {
            const approved = isGroupApproved(chatId);
            await sock.sendMessage(chatId, {
                text: approved
                    ? '*✅ This group is APPROVED — Islamic messages active.*'
                    : '*❌ This group is NOT approved — Islamic messages are OFF.*'
            }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        if (action === 'approve' || action === 'on') {
            if (isGroupApproved(chatId)) {
                await sock.sendMessage(chatId, { text: '*_This group is already approved._*' }, { quoted: message });
                return;
            }
            const ok = approveGroup(chatId);
            await sock.sendMessage(chatId, {
                text: ok
                    ? '*✅ Group APPROVED!* \nIslamic hourly + namaz پیغامات اب اس گروپ میں آئیں گے۔'
                    : '*_Failed to approve group._*'
            }, { quoted: message });
            return;
        }

        if (action === 'disapprove' || action === 'off' || action === 'remove') {
            if (!isGroupApproved(chatId)) {
                await sock.sendMessage(chatId, { text: '*_This group is not approved._*' }, { quoted: message });
                return;
            }
            const ok = disapproveGroup(chatId);
            await sock.sendMessage(chatId, {
                text: ok
                    ? '*❌ Group DISAPPROVED.* \nIslamic پیغامات اب اس گروپ میں نہیں آئیں گے۔'
                    : '*_Failed to disapprove group._*'
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { text: usage }, { quoted: message });
    } catch (err) {
        console.error('[Islamic] handleIslamicCommand error:', err.message);
        await sock.sendMessage(chatId, { text: '*_Error processing islamic command._*' }, { quoted: message });
    }
}

module.exports = {
    initIslamicScheduler,
    reinitIslamicScheduler,
    stopIslamicSchedulers,
    sendHourlyMessage,
    sendNamazAlert,
    handleIslamicCommand,
    loadApprovedGroups,
    approveGroup,
    disapproveGroup,
    isGroupApproved,
};
