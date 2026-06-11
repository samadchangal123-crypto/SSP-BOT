const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function emojiGifCommand(sock, chatId, msg) {
    let webpFile = null;
    let gifFile = null;
    try {
        const text = msg.message?.conversation?.trim() ||
                     msg.message?.extendedTextMessage?.text?.trim() || '';

        const args = text.split(' ').slice(1);
        const emote = args[0];

        if (!emote) {
            await sock.sendMessage(chatId, {
                text: '🎴 *Emoji GIF Maker*\n\n📌 Example: *.emojigif* 😭\n\nGives you the animated version of any emoji.'
            }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: msg.key }
        });

        const response = await fetch('https://anabot.my.id/api/maker/emojiGif', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emote: emote, apikey: 'freeApikey' })
        });

        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }

        const buffer = await response.buffer();

        if (!buffer || buffer.length < 100) {
            await sock.sendMessage(chatId, {
                text: '❌ Couldn\'t generate a GIF for that emoji. Try a different one!'
            }, { quoted: msg });
            return;
        }

        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const ts = Date.now();
        webpFile = path.join(tmpDir, `emojigif_${ts}.webp`);
        gifFile  = path.join(tmpDir, `emojigif_${ts}.gif`);

        fs.writeFileSync(webpFile, buffer);

        // Send as animated sticker (WhatsApp supports animated WebP natively)
        try {
            await sock.sendMessage(chatId, {
                sticker: buffer
            }, { quoted: msg });
        } catch (stickerErr) {
            console.error('Sticker send failed, falling back to GIF video:', stickerErr.message);

            // Fallback: convert WebP to MP4 (gifPlayback requires MP4) using ffmpeg
            const mp4File = path.join(tmpDir, `emojigif_${ts}.mp4`);
            const ffmpegCmd = `ffmpeg -y -i "${webpFile}" -movflags +faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${mp4File}"`;

            await new Promise((resolve, reject) => {
                exec(ffmpegCmd, (error) => error ? reject(error) : resolve());
            });

            const mp4Buffer = fs.readFileSync(mp4File);
            await sock.sendMessage(chatId, {
                video: mp4Buffer,
                gifPlayback: true,
                caption: `✨ Emoji GIF: ${emote}`
            }, { quoted: msg });

            try { fs.unlinkSync(mp4File); } catch (_) {}
        }

        await sock.sendMessage(chatId, {
            react: { text: '✅', key: msg.key }
        });

    } catch (error) {
        console.error('Error in emojigif command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to make the emoji GIF. Please try again later.\n\nExample: .emojigif 😭'
        }, { quoted: msg });
    } finally {
        try { if (webpFile && fs.existsSync(webpFile)) fs.unlinkSync(webpFile); } catch (_) {}
        try { if (gifFile  && fs.existsSync(gifFile))  fs.unlinkSync(gifFile);  } catch (_) {}
    }
}

module.exports = emojiGifCommand;
