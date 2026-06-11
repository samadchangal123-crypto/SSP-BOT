const axios = require('axios');

const processedMessages = new Set();

async function pinterestCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, {
                text: '📌 *Pinterest Downloader*\n\nUsage: .pinterest <Pinterest URL>\n\nExample:\n.pinterest https://in.pinterest.com/pin/1109363320773690068/'
            }, { quoted: message });
        }

        let urlMatch = text.match(/https?:\/\/[^\s]*pinterest[^\s]*\/pin\/[^\s]+/i);
        if (!urlMatch) urlMatch = text.match(/https?:\/\/pin\.it\/[^\s]+/i);
        if (!urlMatch) urlMatch = text.match(/pin\.it\/[^\s]+/i);

        if (!urlMatch) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a valid Pinterest pin URL!\n\nExamples:\n• https://in.pinterest.com/pin/1109363320773690068/\n• https://pin.it/dddddd'
            }, { quoted: message });
        }

        const pinterestUrl = urlMatch[0];

        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });

        let response;
        try {
            response = await axios.get(`https://api.nexray.web.id/downloader/pinterest?url=${encodeURIComponent(pinterestUrl)}`, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
        } catch (err) {
            console.error('Pinterest API Error:', err);
            const status = err.response?.status;
            if (status === 400) return await sock.sendMessage(chatId, { text: '❌ Invalid Pinterest URL. Please check the link.' }, { quoted: message });
            if (status === 429) return await sock.sendMessage(chatId, { text: '❌ Rate limit exceeded. Please try again later.' }, { quoted: message });
            return await sock.sendMessage(chatId, { text: '❌ Failed to fetch Pinterest content. Please try again.' }, { quoted: message });
        }

        if (!response.data?.status || !response.data?.result) {
            return await sock.sendMessage(chatId, { text: '❌ Invalid response from API. The pin might not exist or be private.' }, { quoted: message });
        }

        const pinData = response.data.result;
        const isVideo = !!pinData.video;
        const mediaUrl = pinData.video || pinData.image || pinData.url;
        const title = pinData.title || 'Pinterest Pin';
        const author = pinData.author || '';

        if (!mediaUrl) {
            return await sock.sendMessage(chatId, { text: '❌ No media URL found in API response.' }, { quoted: message });
        }

        let caption = `📌 *${title}*\n`;
        if (author && author !== 'Unknown') caption += `👤 Author: ${author}\n`;
        caption += `\n*Downloaded by RDX BOT*`;

        if (isVideo) {
            try {
                const videoRes = await axios.get(mediaUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000,
                    maxContentLength: 100 * 1024 * 1024,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'video/mp4,video/*,*/*', 'Referer': 'https://www.pinterest.com/' }
                });
                const videoBuffer = Buffer.from(videoRes.data);
                if (!videoBuffer || videoBuffer.length < 100) throw new Error('Video buffer too small');
                await sock.sendMessage(chatId, { video: videoBuffer, caption }, { quoted: message });
            } catch (err) {
                console.error('Pinterest video error:', err.message);
                await sock.sendMessage(chatId, { text: '❌ Failed to download or send Pinterest video.' }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { image: { url: mediaUrl }, caption }, { quoted: message });
        }
    } catch (err) {
        console.error('Pinterest command error:', err);
        await sock.sendMessage(chatId, { text: `❌ Error: ${err.message || 'Unknown error occurred'}` }, { quoted: message });
    }
}

module.exports = pinterestCommand;
