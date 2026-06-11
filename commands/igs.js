const { igdl } = require('ruhend-scraper');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');
const settings = require('../rdx-settings');

function getTempDir() {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
}

function deleteTempFile(filePath) {
    setTimeout(() => {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }, 5000);
}

function extractInstagramUrl(proxyUrl) {
    try {
        const urlObj = new URL(proxyUrl);
        const token = urlObj.searchParams.get('token');
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
        if (payload.url && typeof payload.url === 'string' && payload.url.startsWith('http')) return payload.url;
    } catch {}
    return null;
}

function pickMediaUrl(media) {
    if (!media) return null;
    const candidates = [media.downloadUrl, media.url, media.original, media.mediaUrl, media.videoUrl, media.imageUrl, media.urls?.[0]];
    for (const candidate of candidates) {
        if (candidate && typeof candidate === 'string' && candidate.startsWith('http')) {
            if (candidate.includes('rapidcdn.app') && candidate.includes('token=')) {
                const instagramUrl = extractInstagramUrl(candidate);
                if (instagramUrl) return instagramUrl;
            }
            return candidate;
        }
    }
    return null;
}

async function convertBufferToStickerWebp(inputBuffer, isAnimated, cropSquare) {
    if (inputBuffer.length > 50 * 1024 * 1024) throw new Error('File too large (max 50MB)');
    const tmpDir = getTempDir();
    const tempInputBase = path.join(tmpDir, `igs_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const tempInput = isAnimated ? `${tempInputBase}.mp4` : `${tempInputBase}.jpg`;
    const tempOutput = path.join(tmpDir, `igs_out_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);
    const tempFiles = [tempInput, tempOutput];

    try {
        fs.writeFileSync(tempInput, inputBuffer);

        const vfCropSquareImg = "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512";
        const vfPadSquareImg = "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000";

        let ffmpegCommand;
        if (isAnimated) {
            if (cropSquare) {
                ffmpegCommand = `ffmpeg -y -i "${tempInput}" -t 2 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=6" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 25 -compression_level 6 -b:v 60k -max_muxing_queue_size 1024 "${tempOutput}"`;
            } else {
                ffmpegCommand = `ffmpeg -y -i "${tempInput}" -t 2 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=6" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 25 -compression_level 6 -b:v 60k -max_muxing_queue_size 1024 "${tempOutput}"`;
            }
        } else {
            const vf = `${cropSquare ? vfCropSquareImg : vfPadSquareImg},format=rgba`;
            ffmpegCommand = `ffmpeg -y -i "${tempInput}" -vf "${vf}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 60 -compression_level 6 "${tempOutput}"`;
        }

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error) => error ? reject(error) : resolve());
        });

        let webpBuffer = fs.readFileSync(tempOutput);
        let attempts = 0;
        const maxAttempts = 8;
        while (webpBuffer.length > 950 * 1024 && attempts < maxAttempts) {
            attempts++;
            try {
                const tempOutput2 = path.join(tmpDir, `igs_out${attempts}_${Date.now()}.webp`);
                tempFiles.push(tempOutput2);
                let harsherCmd;
                if (isAnimated) {
                    const fps = Math.max(3, 6 - attempts);
                    const quality = Math.max(10, 25 - (attempts * 3));
                    const bitrate = Math.max(30, 60 - (attempts * 5));
                    const duration = Math.max(0.5, 2 - (attempts * 0.25));
                    const size = attempts <= 2 ? 512 : (attempts <= 4 ? 400 : (attempts <= 6 ? 320 : 256));
                    if (cropSquare) {
                        harsherCmd = `ffmpeg -y -i "${tempInput}" -t ${duration} -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=${size}:${size},fps=${fps}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality ${quality} -compression_level 6 -b:v ${bitrate}k -max_muxing_queue_size 1024 "${tempOutput2}"`;
                    } else {
                        harsherCmd = `ffmpeg -y -i "${tempInput}" -t ${duration} -vf "scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=${fps}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality ${quality} -compression_level 6 -b:v ${bitrate}k -max_muxing_queue_size 1024 "${tempOutput2}"`;
                    }
                } else {
                    const quality = Math.max(30, 60 - (attempts * 5));
                    const size = attempts === 1 ? 512 : (attempts === 2 ? 400 : (attempts === 3 ? 320 : (attempts === 4 ? 256 : 200)));
                    const vf = cropSquare
                        ? `crop=min(iw\\,ih):min(iw\\,ih),scale=${size}:${size},format=rgba`
                        : `scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=#00000000,format=rgba`;
                    harsherCmd = `ffmpeg -y -i "${tempInput}" -vf "${vf}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality ${quality} -compression_level 6 "${tempOutput2}"`;
                }
                await new Promise((resolve, reject) => { exec(harsherCmd, (err) => err ? reject(err) : resolve()); });
                if (fs.existsSync(tempOutput2)) webpBuffer = fs.readFileSync(tempOutput2);
            } catch { if (attempts >= maxAttempts) break; }
        }

        const img = new webp.Image();
        await img.load(webpBuffer);
        const json = {
            'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
            'sticker-pack-name': settings.packname || 'RDX BOT',
            'emojis': ['📸']
        };
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);
        img.exif = exif;
        return await img.save(null);
    } finally {
        tempFiles.forEach(file => deleteTempFile(file));
    }
}

async function fetchBufferFromUrl(url) {
    const maxRetries = 3;
    const standardHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*', 'Cache-Control': 'no-cache'
    };
    const instagramHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'
    };

    function isHtmlResponse(buffer) {
        if (!buffer || buffer.length < 10) return false;
        const start = buffer.toString('utf8', 0, 100).toLowerCase().trim();
        return start.startsWith('<!doctype html') || start.startsWith('<html');
    }

    function isValidContentType(ct) {
        if (!ct) return true;
        const c = ct.toLowerCase();
        return c.startsWith('image/') || c.startsWith('video/') || c === 'application/octet-stream';
    }

    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const headers = attempt === 0 ? standardHeaders : instagramHeaders;
            const res = await axios.get(url, {
                responseType: 'arraybuffer', headers, timeout: 30000,
                maxContentLength: Infinity, maxBodyLength: Infinity,
                maxRedirects: 5, validateStatus: s => s >= 200 && s < 300
            });
            const buffer = Buffer.from(res.data);
            if (!isValidContentType(res.headers['content-type'])) throw new Error(`Invalid content-type: ${res.headers['content-type']}`);
            if (isHtmlResponse(buffer)) throw new Error('Response is HTML (blocked/login required)');
            return buffer;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, (attempt + 1) * 500));
        }
    }
    throw new Error(`Failed to download media after ${maxRetries} attempts: ${lastError?.message}`);
}

async function igsCommand(sock, chatId, message, cropSquare) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const urlMatch = text.match(/https?:\/\/\S+/);
        if (!urlMatch) {
            return await sock.sendMessage(chatId, {
                text: `Send an Instagram post/reel link.\nUsage:\n.igs <url> (padded)\n.igsc <url> (cropped)`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });

        const downloadData = await igdl(urlMatch[0]).catch(() => null);
        if (!downloadData?.data) {
            return await sock.sendMessage(chatId, { text: '❌ Failed to fetch media from Instagram link.' }, { quoted: message });
        }

        const mediaData = downloadData.data || [];
        const items = mediaData.filter(m => m && pickMediaUrl(m)).slice(0, 10);

        if (items.length === 0) {
            return await sock.sendMessage(chatId, { text: '❌ No media found at the provided link.' }, { quoted: message });
        }

        const seenHashes = new Set();
        for (let i = 0; i < items.length; i++) {
            try {
                const media = items[i];
                const mediaUrl = pickMediaUrl(media);
                if (!mediaUrl) continue;

                const isVideo = (media?.type === 'video') || /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl);
                const buffer = await fetchBufferFromUrl(mediaUrl);

                const contentHash = crypto.createHash('md5').update(buffer).digest('hex');
                if (seenHashes.has(contentHash)) continue;
                seenHashes.add(contentHash);

                const stickerBuffer = await convertBufferToStickerWebp(buffer, isVideo, cropSquare);
                await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });

                if (i < items.length - 1) await new Promise(r => setTimeout(r, 800));
            } catch (err) {
                console.error(`Error processing item ${i + 1}:`, err.message);
            }
        }
    } catch (err) {
        console.error('IGS command error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to create sticker from Instagram link.' }, { quoted: message });
    }
}

module.exports = { igsCommand };
