const axios = require('axios');

const HTTP = {
    timeout: 90000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
    },
    validateStatus: s => s >= 200 && s < 500
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SUNO_API_KEY = '02307a49567d8c84ec8259b4dd87c061';
const SUNO_API_BASE = 'https://api.sunoapi.org';

async function generateWithSunoAPI(lyrics, style, instrumental) {
    const payload = {
        customMode: true,
        instrumental: instrumental,
        model: 'V4_5ALL',
        callBackUrl: 'https://example.com/callback',
        prompt: lyrics,
        style: style || 'Pop',
        title: 'Suno Song',
        personaId: '',
        personaModel: '',
        negativeTags: '',
        vocalGender: 'm',
        styleWeight: 0.5,
        weirdnessConstraint: 0.5,
        audioWeight: 0.5
    };

    const response = await axios.post(
        `${SUNO_API_BASE}/api/v1/generate`,
        payload,
        {
            headers: {
                'Authorization': `Bearer ${SUNO_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 90000,
            validateStatus: () => true
        }
    );

    if (!response.data || response.data.code !== 200) {
        throw new Error(`API Error: ${response.data?.msg || 'Unknown error'}`);
    }

    return response.data.data.taskId;
}

async function checkTaskStatus(taskId) {
    const response = await axios.get(
        `${SUNO_API_BASE}/api/v1/generate/record-info?taskId=${taskId}`,
        {
            headers: {
                'Authorization': `Bearer ${SUNO_API_KEY}`
            },
            timeout: 30000
        }
    );

    if (response.data.code !== 200) {
        throw new Error(`Status check failed: ${response.data.msg}`);
    }

    const data = response.data.data;
    if (data.status === 'SUCCESS' && data.response?.sunoData?.[0]) {
        return {
            status: data.status,
            audioUrl: data.response.sunoData[0].audioUrl,
            imageUrl: data.response.sunoData[0].imageUrl,
            title: data.response.sunoData[0].title || 'Suno Song'
        };
    }
    return { status: data.status };
}

async function generateSong(lyrics, style, instrumental, onProgress) {
    if (onProgress) onProgress('submitting');
    
    const taskId = await generateWithSunoAPI(lyrics, style, instrumental);
    console.log(`[Suno] Task submitted: ${taskId}`);

    if (onProgress) onProgress('waiting');

    let attempts = 0;
    const maxAttempts = 90;

    while (attempts < maxAttempts) {
        await sleep(5000);
        attempts++;

        const result = await checkTaskStatus(taskId);

        if (result.audioUrl) {
            return {
                audioUrl: result.audioUrl,
                title: result.title || 'Suno Song',
                thumbnail: result.imageUrl,
                provider: 'Suno API'
            };
        }

        if (result.status === 'CREATE_TASK_FAILED' || result.status === 'GENERATE_AUDIO_FAILED') {
            throw new Error('Generation failed on server');
        }

        if (onProgress) onProgress(`${result.status} (${attempts}/90)`);
        console.log(`[Suno] Status: ${result.status}, attempt ${attempts}`);
    }

    throw new Error('Timeout: generation took too long');
}

async function downloadAudio(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': '*/*'
        }
    });
    return Buffer.from(res.data);
}

async function sunoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation
            || message.message?.extendedTextMessage?.text
            || '';
        const args = text.split(' ').slice(1).join(' ').trim();

        if (!args) {
            return sock.sendMessage(chatId, {
                text: '🎵 *SUNO AI MUSIC GENERATOR*\n\n' +
                      '📌 *Usage:*\n' +
                      '`.suno <lyrics>`\n' +
                      '`.suno <lyrics> | <style>`\n' +
                      '`.suno <lyrics> | <style> | <instrumen>`\n\n' +
                      '🎼 *Examples:*\n' +
                      '• `.suno A peaceful morning melody`\n' +
                      '• `.suno Romantic song | Pop`\n' +
                      '• `.suno Classical piano | Classical | yes`\n\n' +
                      '💡 *instrumen* = `yes` (no vocals) / `no` (with vocals)\n\n' +
                      '🎵 *Model:* V4_5ALL (Premium Quality)'
            }, { quoted: message });
        }

        const parts = args.split('|').map(s => s.trim());
        const lyrics = parts[0];
        const style = parts[1] || 'Pop';
        const instrumental = (parts[2] || '').toLowerCase() === 'yes';

        await sock.sendMessage(chatId, {
            text: `🎵 *Generating song...*\n\n📝 *Prompt:* ${lyrics.substring(0, 50)}${lyrics.length > 50 ? '...' : ''}\n📝 *Style:* ${style}\n🎤 *Vocals:* ${instrumental ? 'No (instrumental)' : 'Yes'}\n\n⏳ This may take 30-90 seconds...`
        }, { quoted: message });

        const result = await generateSong(lyrics, style, instrumental, (status) => {
            console.log(`[Suno] ${status}`);
        });

        if (result.thumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: result.thumbnail },
                    caption: `🎵 *${result.title}*\n⬇️ Downloading audio...`
                }, { quoted: message });
            } catch (_) {}
        }

        const audioBuffer = await downloadAudio(result.audioUrl);
        const safeName = (result.title || 'suno').replace(/[^\w\s-]/g, '').trim().substring(0, 60) || 'suno';

        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${safeName}.mp3`,
            ptt: false
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            text: `✅ *Done!*\n🎵 *${result.title}*\n🎚️ Generated via *${result.provider}*\n💾 Quality: V4_5ALL`
        }, { quoted: message });

    } catch (err) {
        console.error('[Suno] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ *Song generation failed.*\n\nError: ${err.message}\n\nPlease check your API credits and try again.`
        }, { quoted: message });
    }
}

module.exports = sunoCommand;
module.exports.generateSong = generateSong;