const yts = require('yt-search');
const axios = require('axios');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: "What song do you want to download?"
            });
        }

        // Search for the song
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "No songs found!"
            });
        }

        const video = videos[0];
        const urlYt = video.url;

        const frames = [
            "🩵▰▱▱▱▱▱▱▱▱▱ 10%",
            "💙▰▰▱▱▱▱▱▱▱▱ 25%",
            "💜▰▰▰▰▱▱▱▱▱▱ 45%",
            "💖▰▰▰▰▰▰▱▱▱▱ 70%",
            "💗▰▰▰▰▰▰▰▰▰▰ 100% 😍"
        ];

        // Send the first loading frame
        const sent = await sock.sendMessage(chatId, {
            text: `🎵 *Downloading...*\n${frames[0]}`
        }, { quoted: message });

        // Start fetching audio in parallel with the animation
        const fetchPromise = axios
            .get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`)
            .then(r => r.data)
            .catch(e => ({ __error: e }));

        // Animate by editing the same message
        for (let i = 1; i < frames.length; i++) {
            await sleep(700);
            try {
                await sock.sendMessage(chatId, {
                    text: `🎵 *Downloading...*\n${frames[i]}`,
                    edit: sent.key
                });
            } catch { /* edit failures are non-fatal */ }
        }

        const data = await fetchPromise;

        if (!data || data.__error || !data.status || !data.result || !data.result.downloadUrl) {
            try {
                await sock.sendMessage(chatId, {
                    text: "❌ Failed to fetch audio from the API. Please try again later.",
                    edit: sent.key
                });
            } catch {
                await sock.sendMessage(chatId, {
                    text: "❌ Failed to fetch audio from the API. Please try again later."
                });
            }
            return;
        }

        const audioUrl = data.result.downloadUrl;
        const title = data.result.title;

        // Send the audio
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('Error in play command:', error);
        await sock.sendMessage(chatId, {
            text: "Download failed. Please try again later."
        });
    }
}

module.exports = playCommand;

/*Powered by KNIGHT-BOT*
*Credits to Keith MD*`*/
