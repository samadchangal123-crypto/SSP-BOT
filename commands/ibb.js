const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || 'e17a15dd6af452cbe53747c0b2b0866d';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

const TMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function convertToGif(inputBuffer, ext = 'mp4') {
    return new Promise((resolve, reject) => {
        const id = crypto.randomBytes(6).toString('hex');
        const inPath = path.join(TMP_DIR, `ibb_${id}.${ext}`);
        const outPath = path.join(TMP_DIR, `ibb_${id}.gif`);

        try {
            fs.writeFileSync(inPath, inputBuffer);
        } catch (e) {
            return reject(e);
        }

        const cmd = `ffmpeg -y -i "${inPath}" -vf "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${outPath}"`;

        exec(cmd, { timeout: 60000 }, (err) => {
            try { fs.unlinkSync(inPath); } catch (_) {}
            if (err) {
                try { fs.unlinkSync(outPath); } catch (_) {}
                return reject(err);
            }
            try {
                const buf = fs.readFileSync(outPath);
                fs.unlinkSync(outPath);
                resolve(buf);
            } catch (e) {
                reject(e);
            }
        });
    });
}

const channelInfo = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363407914650384@newsletter',
            newsletterName: 'RDX BOT',
            serverMessageId: -1
        }
    }
};

function formatBytes(bytes) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function uploadToImgBB(buffer) {
    const base64Image = buffer.toString('base64');
    const formData = new URLSearchParams();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64Image);

    const res = await axios.post(IMGBB_UPLOAD_URL, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });

    return res.data?.data;
}

async function ibbCommand(sock, chatId, message) {
    const messageToQuote = message;
    let targetMessage = message;

    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedInfo = message.message.extendedTextMessage.contextInfo;
        targetMessage = {
            key: {
                remoteJid: chatId,
                id: quotedInfo.stanzaId,
                participant: quotedInfo.participant
            },
            message: quotedInfo.quotedMessage
        };
    }

    const imageMessage = targetMessage.message?.imageMessage;
    const stickerMessage = targetMessage.message?.stickerMessage;
    const videoMessage = targetMessage.message?.videoMessage;
    const documentMessage = targetMessage.message?.documentMessage;

    const isImageDoc = documentMessage && (documentMessage.mimetype || '').startsWith('image/');
    const isVideoDoc = documentMessage && (documentMessage.mimetype || '').startsWith('video/');
    const isAnimatedSticker = stickerMessage && stickerMessage.isAnimated;
    const isGifVideo = videoMessage && (videoMessage.gifPlayback || videoMessage.mimetype === 'image/gif');
    const isPlainVideo = videoMessage && !isGifVideo;

    const needsGifConversion = isGifVideo || isPlainVideo || isVideoDoc || isAnimatedSticker;

    if (!imageMessage && !stickerMessage && !isImageDoc && !videoMessage && !isVideoDoc) {
        await sock.sendMessage(chatId, {
            text: `╭━━━〔 *🖼 IBB UPLOADER* 〕━━━╮
┃
┃ ❌ *Koi image/gif nahi mili!*
┃
┃ 📌 *Tariqa-e-Istimal:*
┃ • Image par reply karo *.ibb* likh kar
┃ • GIF/Video par reply karo *.ibb*
┃ • Ya media bhejo aur caption *.ibb* likho
┃
┃ ✅ *Supported:*
┃ • Image (JPG/PNG/WEBP)
┃ • Animated GIF
┃ • Short Video (auto-converts to GIF)
┃ • Sticker (static + animated)
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
            ...channelInfo
        }, { quoted: messageToQuote });
        return;
    }

    // Limit video size to avoid huge GIFs
    if (needsGifConversion) {
        const sizeBytes = videoMessage?.fileLength || documentMessage?.fileLength || 0;
        const sizeNum = typeof sizeBytes === 'object' ? parseInt(sizeBytes.low || sizeBytes) : parseInt(sizeBytes);
        if (sizeNum && sizeNum > 15 * 1024 * 1024) {
            await sock.sendMessage(chatId, {
                text: `❌ Video bohat bara hai (${(sizeNum / (1024 * 1024)).toFixed(1)} MB)!\n\n⚠ Maximum *15 MB* tak ki video/gif convert kar sakte hain.`,
                ...channelInfo
            }, { quoted: messageToQuote });
            return;
        }

        const durationSec = videoMessage?.seconds || 0;
        if (durationSec && durationSec > 30) {
            await sock.sendMessage(chatId, {
                text: `❌ Video bohat lambi hai (${durationSec}s)!\n\n⚠ Maximum *30 second* tak ki video GIF mein convert ho sakti hai.`,
                ...channelInfo
            }, { quoted: messageToQuote });
            return;
        }
    }

    // React to indicate processing
    try {
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: messageToQuote.key }
        });
    } catch (_) {}

    try {
        let mediaBuffer = await downloadMediaMessage(
            targetMessage,
            'buffer',
            {},
            { logger: undefined, reuploadRequest: sock.updateMediaMessage }
        );

        if (!mediaBuffer || mediaBuffer.length === 0) {
            throw new Error('Empty buffer');
        }

        let mediaType = 'Image';

        if (needsGifConversion) {
            mediaType = isGifVideo ? 'GIF' : (isAnimatedSticker ? 'Animated Sticker → GIF' : 'Video → GIF');
            const ext = isAnimatedSticker ? 'webp' : 'mp4';
            mediaBuffer = await convertToGif(mediaBuffer, ext);
            if (!mediaBuffer || mediaBuffer.length === 0) {
                throw new Error('GIF conversion failed');
            }
        } else if (stickerMessage) {
            mediaType = 'Sticker';
        }

        const data = await uploadToImgBB(mediaBuffer);

        if (!data || !data.url) {
            throw new Error('No URL returned');
        }

        const sizeStr = formatBytes(mediaBuffer.length);
        const dimStr = (data.width && data.height) ? `${data.width} x ${data.height}` : 'N/A';
        const expiry = data.expiration && parseInt(data.expiration) > 0
            ? `${Math.floor(parseInt(data.expiration) / 86400)} din`
            : 'Permanent';

        const caption = `╭━━━〔 *✨ MEDIA UPLOADED* 〕━━━╮
┃
┃ ✅ *Status:* Successful
┃ 🎯 *Type:* ${mediaType}
┃ 📐 *Size:* ${dimStr}
┃ 💾 *Weight:* ${sizeStr}
┃ ⏱ *Expiry:* ${expiry}
┃
┣━━━〔 *🔗 LINKS* 〕━━━━━━━━
┃
┃ 🌐 *Direct URL:*
┃ ${data.url}
┃
┃ 🖼 *Display URL:*
┃ ${data.display_url || data.url}
┃${data.delete_url ? `\n┃ 🗑 *Delete URL:*\n┃ ${data.delete_url}\n┃` : ''}
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`;

        await sock.sendMessage(chatId, {
            text: caption,
            ...channelInfo
        }, { quoted: messageToQuote });

        try {
            await sock.sendMessage(chatId, {
                react: { text: '✅', key: messageToQuote.key }
            });
        } catch (_) {}

    } catch (err) {
        console.error('[ibb] Upload error:', err?.response?.data || err.message);

        try {
            await sock.sendMessage(chatId, {
                react: { text: '❌', key: messageToQuote.key }
            });
        } catch (_) {}

        const apiMsg = err?.response?.data?.error?.message || err.message || 'Unknown error';

        await sock.sendMessage(chatId, {
            text: `╭━━━〔 *⚠ UPLOAD FAILED* 〕━━━╮
┃
┃ ❌ Image upload nahi ho saki!
┃
┃ 🐞 *Reason:* ${apiMsg}
┃
┃ 🔁 Thori dair baad dobara try karo.
┃
╰━━━━━━━━━━━━━━━━━━━╯

🤖 _Powered by RDX BOT_`,
            ...channelInfo
        }, { quoted: messageToQuote });
    }
}

module.exports = ibbCommand;
