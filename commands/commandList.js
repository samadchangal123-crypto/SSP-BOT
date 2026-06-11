// ============================================================
//  COMMAND REGISTRY — Add new commands here, help auto-updates
// ============================================================
//  Each entry: { cmd: '.name', desc: 'short description' }
// ============================================================

const COMMANDS = {

    '🌐 GENERAL': [
        { cmd: '.help / .menu',   desc: 'Ye command list' },
        { cmd: '.ping',           desc: 'Bot check karo' },
        { cmd: '.alive',          desc: 'Bot zinda hai?' },
        { cmd: '.upt',            desc: 'Uptime + system stats' },
        { cmd: '.info',           desc: 'Bot ki full info' },
        { cmd: '.owner',          desc: 'Owner ki info' },
        { cmd: '.prefix',         desc: 'Bot prefix dekhein' },
        { cmd: '.jid',            desc: 'Group JID dekhein' },
        { cmd: '.groupinfo',      desc: 'Group ki details' },
        { cmd: '.staff / .admins',desc: 'Group admins list' },
        { cmd: '.topmembers',     desc: 'Top active members' },
        { cmd: '.settings',       desc: 'Bot settings' },
        { cmd: '.sudo',           desc: 'Sudo user add/remove' },
    ],

    '👮 ADMIN': [
        { cmd: '.ban @user',      desc: 'Member remove karo' },
        { cmd: '.unban @user',    desc: 'Member unban karo' },
        { cmd: '.kick @user',     desc: 'Member kick karo' },
        { cmd: '.promote @user',  desc: 'Admin banao' },
        { cmd: '.demote @user',   desc: 'Admin remove karo' },
        { cmd: '.mute <min>',     desc: 'Group band karo' },
        { cmd: '.unmute',         desc: 'Group kholo' },
        { cmd: '.clear',          desc: 'Messages clear karo' },
        { cmd: '.delete / .del',  desc: 'Message delete karo' },
        { cmd: '.warn @user',     desc: 'Warning do' },
        { cmd: '.warnings @user', desc: 'Warnings dekhein' },
        { cmd: '.tag <msg>',      desc: 'Sab ko tag karo' },
        { cmd: '.tagall',         desc: 'Sab members tag' },
        { cmd: '.tagnotadmin',    desc: 'Non-admins tag karo' },
        { cmd: '.hidetag <msg>',  desc: 'Silent tag' },
        { cmd: '.antilink on/off',desc: 'Link protection' },
        { cmd: '.antibadword on/off', desc: 'Bad word filter' },
        { cmd: '.antitag on/off', desc: 'Anti-tag protection' },
        { cmd: '.chatbot on/off', desc: 'AI chatbot toggle' },
        { cmd: '.welcome on/off', desc: 'Welcome message' },
        { cmd: '.goodbye on/off', desc: 'Goodbye message' },
        { cmd: '.resetlink',      desc: 'Group link reset' },
        { cmd: '.setgdesc',       desc: 'Group description set' },
        { cmd: '.setgname',       desc: 'Group name set' },
        { cmd: '.setgpp',         desc: 'Group photo set' },
        { cmd: '.mention on/off', desc: 'Auto-mention toggle' },
        { cmd: '.out',            desc: 'Bot group chor de' },
    ],

    '🔐 OWNER ONLY': [
        { cmd: '.mode pub/pri',   desc: 'Bot mode public/private' },
        { cmd: '.anticall on/off',desc: 'Call blocker' },
        { cmd: '.pmblocker on/off', desc: 'PM spam blocker' },
        { cmd: '.antidelete on/off', desc: 'Anti-delete' },
        { cmd: '.autoreact on/off', desc: 'Auto react' },
        { cmd: '.autotyping on/off', desc: 'Auto typing indicator' },
        { cmd: '.autoread on/off',desc: 'Auto read messages' },
        { cmd: '.autostatus',     desc: 'Status auto-reply' },
        { cmd: '.setpp',          desc: 'Bot photo badlo' },
        { cmd: '.cleartmp',       desc: 'Temp files delete' },
        { cmd: '.clearsession',   desc: 'Session clear' },
        { cmd: '.update',         desc: 'Bot update check' },
        { cmd: '.convo on',       desc: 'Auto-send loop shuru' },
        { cmd: '.convo off',      desc: 'Auto-send loop band' },
    ],

    '🤖 AI COMMANDS': [
        { cmd: '.mano <sawaal>',  desc: 'Mano AI (Gemini 2.5)' },
        { cmd: '.manoclear',      desc: 'AI chat history clear' },
        { cmd: '.gpt <ques>',     desc: 'ChatGPT se pooch' },
        { cmd: '.gemini <ques>',  desc: 'Gemini AI' },
        { cmd: '.imagine <text>', desc: 'AI image generate' },
        { cmd: '.flux <prompt>',  desc: 'Flux image AI' },
        { cmd: '.sora <prompt>',  desc: 'Sora image AI' },
    ],

    '🎨 STICKER / IMAGE': [
        { cmd: '.sticker / .s',   desc: 'Image → Sticker' },
        { cmd: '.simage',         desc: 'Sticker → Image' },
        { cmd: '.take <name>',    desc: 'Sticker rename' },
        { cmd: '.attp <text>',    desc: 'Text → Sticker' },
        { cmd: '.emojimix',       desc: 'Emoji mix sticker' },
        { cmd: '.tgsticker <url>',desc: 'Telegram sticker' },
        { cmd: '.blur',           desc: 'Image blur' },
        { cmd: '.crop',           desc: 'Image crop' },
        { cmd: '.removebg',       desc: 'Background remove' },
        { cmd: '.remini',         desc: 'Image enhance' },
        { cmd: '.ss <url>',       desc: 'Website screenshot' },
    ],

    '📥 DOWNLOADER': [
        { cmd: '.play <song>',    desc: 'YouTube audio' },
        { cmd: '.song <name>',    desc: 'Song download' },
        { cmd: '.video <name>',   desc: 'YouTube video' },
        { cmd: '.ytmp4 <url>',    desc: 'YouTube mp4' },
        { cmd: '.spotify <name>', desc: 'Spotify track' },
        { cmd: '.instagram <url>',desc: 'Instagram reel/post' },
        { cmd: '.tiktok <url>',   desc: 'TikTok video' },
        { cmd: '.facebook <url>', desc: 'Facebook video' },
        { cmd: '.tourl / .url',   desc: 'Media → URL' },
    ],

    '🎮 GAMES': [
        { cmd: '.ttt / .tictactoe', desc: 'TicTacToe game' },
        { cmd: '.hangman',        desc: 'Hangman game' },
        { cmd: '.guess <letter>', desc: 'Hangman guess' },
        { cmd: '.trivia',         desc: 'Trivia quiz' },
        { cmd: '.answer <ans>',   desc: 'Trivia answer' },
        { cmd: '.truth',          desc: 'Truth question' },
        { cmd: '.dare',           desc: 'Dare challenge' },
        { cmd: '.pair',           desc: 'Pair game' },
        { cmd: '.ship @user',     desc: 'Ship meter' },
    ],

    '🎯 FUN': [
        { cmd: '.joke',           desc: 'Random joke' },
        { cmd: '.quote',          desc: 'Inspirational quote' },
        { cmd: '.fact',           desc: 'Random fact' },
        { cmd: '.8ball <ques>',   desc: 'Magic 8-ball' },
        { cmd: '.compliment @',   desc: 'Compliment kisi ko' },
        { cmd: '.insult @',       desc: 'Insult kisi ko' },
        { cmd: '.flirt',          desc: 'Flirt line' },
        { cmd: '.shayari',        desc: 'Urdu shayari' },
        { cmd: '.goodnight',      desc: 'Goodnight message' },
        { cmd: '.roseday',        desc: 'Rose day msg' },
        { cmd: '.simp @user',     desc: 'Simp card' },
        { cmd: '.character @',    desc: 'Character card' },
        { cmd: '.wasted',         desc: 'Wasted image' },
    ],

    '🌍 GENERAL INFO': [
        { cmd: '.weather <city>', desc: 'Mausam ki khabar' },
        { cmd: '.news',           desc: 'Latest news' },
        { cmd: '.lyrics <song>',  desc: 'Song lyrics' },
        { cmd: '.translate <txt>',desc: 'Text translate' },
        { cmd: '.tts <text>',     desc: 'Text to speech' },
    ],

    '🌸 ANIME': [
        { cmd: '.nom',    desc: 'Nom' },   { cmd: '.poke',  desc: 'Poke' },
        { cmd: '.cry',    desc: 'Cry' },   { cmd: '.kiss',  desc: 'Kiss' },
        { cmd: '.pat',    desc: 'Pat' },   { cmd: '.hug',   desc: 'Hug' },
        { cmd: '.wink',   desc: 'Wink' },  { cmd: '.slap',  desc: 'Slap' },
        { cmd: '.facepalm', desc: 'Facepalm' },
    ],

    '🌏 PIES / PHOTOS': [
        { cmd: '.pies <country>', desc: 'Country girls' },
        { cmd: '.china',  desc: 'China' },   { cmd: '.japan',     desc: 'Japan' },
        { cmd: '.korea',  desc: 'Korea' },   { cmd: '.indonesia', desc: 'Indonesia' },
        { cmd: '.india',  desc: 'India' },   { cmd: '.malaysia',  desc: 'Malaysia' },
        { cmd: '.thailand', desc: 'Thailand' },
    ],

    '🧩 MISC / CANVAS': [
        { cmd: '.tweet <text>',   desc: 'Fake tweet card' },
        { cmd: '.ytcomment <txt>',desc: 'Fake YT comment' },
        { cmd: '.oogway <text>',  desc: 'Oogway quote' },
        { cmd: '.namecard @',     desc: 'Name card' },
        { cmd: '.jail',           desc: 'Jail effect' },
        { cmd: '.triggered',      desc: 'Triggered gif' },
        { cmd: '.heart',          desc: 'Heart image' },
        { cmd: '.circle',         desc: 'Circle image' },
        { cmd: '.gay',            desc: 'Gay flag' },
        { cmd: '.comrade',        desc: 'Comrade' },
        { cmd: '.meme',           desc: 'Random meme' },
    ],

    '💻 GITHUB': [
        { cmd: '.git / .github',  desc: 'GitHub info' },
        { cmd: '.sc / .script',   desc: 'Script info' },
        { cmd: '.repo',           desc: 'Repository link' },
    ],
};

module.exports = COMMANDS;
