const fetch = require('node-fetch');

module.exports = async function quoteCommand(sock, chatId, message) {
    try {
        const shizokeys = 'shizo';
        const res = await fetch(`https://shizoapi.onrender.com/api/texts/quotes?apikey=${shizokeys}`);
        
        if (!res.ok) {
            throw await res.text();
        }
        
        const json = await res.json();
        const quoteMessage = json.result;

        // Send the quote message
        await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ 💫 𝑸𝑼𝑶𝑻𝑬 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\n${quoteMessage}` }, { quoted: message });
    } catch (error) {
        console.error('Error in quote command:', error);
        await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ❌ 𝑬𝑹𝑹𝑶𝑹 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\nFailed to get quote. Please try again later!` }, { quoted: message });
    }
};
