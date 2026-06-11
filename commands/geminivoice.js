const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function execPromise(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) return reject(new Error(stderr || error.message));
            resolve(stdout);
        });
    });
}

async function geminiVoiceCommand(sock, chatId, msg) {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const ts = Date.now();
    const inFile  = path.join(tmpDir, `gvoice_in_${ts}.ogg`);
    const outFile = path.join(tmpDir, `gvoice_out_${ts}.ogg`);

    try {
        const text = msg.message?.conversation?.trim() ||
                     msg.message?.extendedTextMessage?.text?.trim() || '';

        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, {
                text: '🎙️ *Gemini Voice*\n\n📌 Example: *.gv* Hello my name is RDX BOT\n\nGives you an AI-generated voice note of any text.'
            }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        const apiResponse = await fetch('https://anabot.my.id/api/ai/geminiVoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: query, apikey: 'freeApikey' })
        });

        if (!apiResponse.ok) throw new Error(`API status ${apiResponse.status}`);

        const data = await apiResponse.json();
        const audioUrl = data?.data?.result;

        if (!data?.success || !audioUrl || !String(audioUrl).startsWith('http')) {
            await sock.sendMessage(chatId, {
                text: '❌ Couldn\'t generate the voice. Please try again with different text.'
            }, { quoted: msg });
            return;
        }

        // Download original audio to disk
        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) throw new Error('Failed to download audio');
        const rawBuffer = await audioRes.buffer();
        fs.writeFileSync(inFile, rawBuffer);

        // Re-encode to WhatsApp-friendly PTT (opus, 16kHz mono in OGG)
        let finalBuffer;
        try {
            await execPromise(
                `ffmpeg -y -i "${inFile}" -c:a libopus -b:a 32k -ac 1 -ar 16000 -application voip -vbr on "${outFile}"`
            );
            finalBuffer = fs.readFileSync(outFile);
        } catch (ffErr) {
            console.warn('ffmpeg re-encode failed, sending raw audio:', ffErr.message);
            finalBuffer = rawBuffer;
        }

        const sendPath = fs.existsSync(outFile) ? outFile : inFile;
        await sock.sendMessage(chatId, {
            audio: { url: sendPath },
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        console.error('Error in geminivoice command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to generate the voice. Please try again later.\n\nExample: .gv Hello my name is RDX BOT'
        }, { quoted: msg });
    } finally {
        try { if (fs.existsSync(inFile))  fs.unlinkSync(inFile);  } catch (_) {}
        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (_) {}
    }
}

module.exports = geminiVoiceCommand;
