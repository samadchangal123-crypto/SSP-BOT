const axios = require('axios');

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await sock.sendMessage(chatId, {
            text: '🔍 Please enter the song name to get the lyrics!\nUsage: *lyrics <song name>*'
        }, { quoted: message });
        return;
    }

    try {
        let lyricsData = null;

        try {
            const res = await axios.get(`https://api.vreden.my.id/api/lyrics?query=${encodeURIComponent(songTitle)}`);
            if (res.data?.result) {
                lyricsData = {
                    title: res.data.result.title,
                    artist: res.data.result.artist,
                    lyrics: res.data.result.lyrics,
                    thumbnail: res.data.result.thumbnail
                };
            }
        } catch {
        }

        if (!lyricsData) {
            try {
                const res = await axios.get(`https://api.siputzx.my.id/api/s/lyrics?query=${encodeURIComponent(songTitle)}`);
                if (res.data?.status && res.data?.data) {
                    lyricsData = {
                        title: res.data.data.title,
                        artist: res.data.data.artist,
                        lyrics: res.data.data.lyrics,
                        thumbnail: res.data.data.image
                    };
                }
            } catch {
            }
        }

        if (!lyricsData) {
            try {
                const res = await axios.get(`https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(songTitle)}`);
                if (res.data?.result?.lyrics) {
                    lyricsData = {
                        title: res.data.result.title || songTitle,
                        artist: res.data.result.artist || 'Unknown',
                        lyrics: res.data.result.lyrics,
                        thumbnail: res.data.result.thumbnail
                    };
                }
            } catch {
            }
        }

        if (!lyricsData) {
            await sock.sendMessage(chatId, {
                text: `❌ Sorry, I couldn't find any lyrics for "${songTitle}".`
            }, { quoted: message });
            return;
        }

        let lyrics = lyricsData.lyrics;
        if (lyrics.length > 4000) {
            lyrics = lyrics.substring(0, 4000) + '...\n\n_Lyrics too long, showing first part only_';
        }

        const caption = `🎵 *${lyricsData.title}*\n` +
            `👤 *Artist:* ${lyricsData.artist}\n\n` +
            `📝 *Lyrics:*\n${lyrics}`;

        if (lyricsData.thumbnail) {
            await sock.sendMessage(chatId, {
                image: { url: lyricsData.thumbnail },
                caption: caption
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }
    } catch (err) {
        console.error('Lyrics command error:', err);
        await sock.sendMessage(chatId, {
            text: `❌ An error occurred while fetching the lyrics for "${songTitle}".`
        }, { quoted: message });
    }
}

module.exports = { lyricsCommand };
