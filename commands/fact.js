const axios = require('axios');

async function factCommand(sock, chatId, message) {
    try {
        const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
        const fact = response.data.text;
        await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ⚡ 𝑭𝑨𝑪𝑻 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\n${fact}` },{ quoted: message });
    } catch (error) {
        console.error('Error fetching fact:', error);
        await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ❌ 𝑬𝑹𝑹𝑶𝑹 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\nSorry, I could not fetch a fact right now.` },{ quoted: message });
    }
}

module.exports = factCommand;