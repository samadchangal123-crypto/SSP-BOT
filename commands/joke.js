const axios = require('axios');

module.exports = async function (sock, chatId) {
    try {
        const response = await axios.get('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json' }
        });
        const joke = response.data.joke;
        await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ 😂 𝑱𝑶𝑲𝑬 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\n${joke}` });
    } catch (error) {
        console.error('Error fetching joke:', error);
        await sock.sendMessage(chatId, { text: `╭━━━━━━━━━━━━━━━━━━╮\n┃ ❌ 𝑬𝑹𝑹𝑶𝑹 ✦\n╰━━━━━━━━━━━━━━━━━━╯\n\nSorry, I could not fetch a joke right now.` });
    }
};
