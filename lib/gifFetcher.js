const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const TMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function gifToMp4(gifBuffer) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomBytes(6).toString('hex');
        const inPath = path.join(TMP_DIR, `gf_${id}.gif`);
        const outPath = path.join(TMP_DIR, `gf_${id}.mp4`);

        try {
            fs.writeFileSync(inPath, gifBuffer);
        } catch (e) {
            return reject(e);
        }

        const cmd = `ffmpeg -y -i "${inPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset veryfast -crf 23 "${outPath}"`;

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

async function fetchAsMp4Buffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.data || res.data.byteLength < 1000) {
        throw new Error('Empty/too small response');
    }
    let buffer = Buffer.from(res.data);
    const isGif = url.toLowerCase().endsWith('.gif') ||
                  (res.headers['content-type'] || '').includes('gif');
    if (isGif) {
        buffer = await gifToMp4(buffer);
    }
    return buffer;
}

async function getRandomGif(urls, fallbackApis = []) {
    const shuffled = [...urls].sort(() => Math.random() - 0.5);
    for (const url of shuffled) {
        try {
            const buffer = await fetchAsMp4Buffer(url);
            return { buffer, source: 'local' };
        } catch (e) {
            console.log(`[gifFetcher] Skipped ${url}: ${e.message}`);
        }
    }
    // Fallbacks
    for (const apiUrl of fallbackApis) {
        try {
            const apiRes = await axios.get(apiUrl, { timeout: 10000 });
            const gifUrl = apiRes.data?.results?.[0]?.url || apiRes.data?.url;
            if (!gifUrl) continue;
            const buffer = await fetchAsMp4Buffer(gifUrl);
            return { buffer, source: 'api' };
        } catch (e) {
            console.log(`[gifFetcher] Fallback failed ${apiUrl}: ${e.message}`);
        }
    }
    throw new Error('All GIF sources failed');
}

module.exports = { getRandomGif, fetchAsMp4Buffer, gifToMp4 };
