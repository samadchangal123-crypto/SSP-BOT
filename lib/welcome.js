const { addWelcome, delWelcome, isWelcomeOn, addGoodbye, delGoodBye, isGoodByeOn } = require('../lib/index');

const DEFAULT_WELCOME = `╔══════════════════════╗
║   🌟 *KHUSH AAMDEED* 🌟   ║
╚══════════════════════╝

👤 *Member:* {user}
🏠 *Group:* {group}
👥 *Total Members:* {count}

━━━━━━━━━━━━━━━━━━━━
🎉 Aapka is group mein dil se swagat hai!
📜 Group rules zaroor parhen
🤝 Sab ke saath achi tarah pesh aayen
🚫 Spam aur abusive language se bachen
━━━━━━━━━━━━━━━━━━━━

🤖 *Powered by RDX Bot*`;

const DEFAULT_GOODBYE = `╔══════════════════════╗
║    👋 *ALVIDA DOST* 👋    ║
╚══════════════════════╝

👤 *Member:* {user}
🏠 *Group:* {group}
👥 *Baaki Members:* {count}

━━━━━━━━━━━━━━━━━━━━
😢 Aap chalay gaye, yaad rahenge!
🌹 Jahan bhi rahein, khush rahein
━━━━━━━━━━━━━━━━━━━━

🤖 *Powered by RDX Bot*`;

async function handleWelcome(sock, chatId, message, args) {
    args = (args || '').trim().toLowerCase();

    // .welcome off — band karo
    if (args === 'off') {
        if (!await isWelcomeOn(chatId)) {
            return sock.sendMessage(chatId, { text: '❌ Welcome pehle se OFF hai!', quoted: message });
        }
        await delWelcome(chatId);
        return sock.sendMessage(chatId, { text: '✅ Welcome OFF kar diya gaya.', quoted: message });
    }

    // .welcome set <msg> — custom message
    if (args.startsWith('set ')) {
        const msg = args.slice(4).trim();
        if (!msg) return sock.sendMessage(chatId, { text: '❌ Message empty hai!', quoted: message });
        await addWelcome(chatId, true, msg);
        return sock.sendMessage(chatId, { text: '✅ Custom welcome message set ho gaya!\n\n_Variables: {user} {group} {count}_', quoted: message });
    }

    // .welcome preview — dekho kaisa dikhega
    if (args === 'preview') {
        const preview = DEFAULT_WELCOME
            .replace(/{user}/g, '@923001234567')
            .replace(/{group}/g, 'RDX Group')
            .replace(/{count}/g, '50');
        return sock.sendMessage(chatId, { text: '*📋 Preview:*\n\n' + preview, quoted: message });
    }

    // .welcome / .welcome on — auto ON with default message
    if (await isWelcomeOn(chatId)) {
        return sock.sendMessage(chatId, { text: '✅ Welcome pehle se ON hai!\n\n_.welcome off_ likhein band karne ke liye.', quoted: message });
    }
    await addWelcome(chatId, true, DEFAULT_WELCOME);
    return sock.sendMessage(chatId, {
        text: '✅ *Welcome ON ho gaya!* 🎉\n\nAb jab bhi koi member join kare ga, bot automatically khubsoorat message bhejega!\n\n_.welcome off_ likhein band karne ke liye.',
        quoted: message
    });
}

async function handleGoodbye(sock, chatId, message, match) {
    const lower = (match || '').trim().toLowerCase();
    
    if (lower === 'on') {
        if (await isGoodByeOn(chatId)) return sock.sendMessage(chatId, { text: '✅ Goodbye pehle se ON hai!', quoted: message });
        await addGoodbye(chatId, true, DEFAULT_GOODBYE);
        return sock.sendMessage(chatId, { 
            text: '✅ *Goodbye ON ho gaya!*\n\nAb jab bhi koi member leave kare ga, bot message bhejega! 👋', 
            quoted: message 
        });
    }
    
    if (lower === 'off') {
        if (!await isGoodByeOn(chatId)) return sock.sendMessage(chatId, { text: '❌ Goodbye pehle se OFF hai!', quoted: message });
        await delGoodBye(chatId);
        return sock.sendMessage(chatId, { text: '✅ Goodbye OFF kar diya gaya.', quoted: message });
    }
    
    if (lower.startsWith('set ')) {
        const msg = match.slice(4).trim();
        if (!msg) return sock.sendMessage(chatId, { text: '❌ Message empty hai!', quoted: message });
        await addGoodbye(chatId, true, msg);
        return sock.sendMessage(chatId, { text: '✅ Custom goodbye message set ho gaya!', quoted: message });
    }
    
    return sock.sendMessage(chatId, { text: '📌 *.goodbye on / off / set <msg>*', quoted: message });
}

module.exports = { handleWelcome, handleGoodbye, DEFAULT_WELCOME, DEFAULT_GOODBYE };
