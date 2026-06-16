const axios = require('axios');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const LOADING_FRAMES = [
    "🩵▰▱▱▱▱▱▱▱▱▱ 10%",
    "💙▰▰▱▱▱▱▱▱▱▱ 25%",
    "💜▰▰▰▰▱▱▱▱▱▱ 45%",
    "💖▰▰▰▰▰▰▱▱▱▱ 70%",
    "💗▰▰▰▰▰▰▰▰▰▰ 100% 😍"
];

// ─── API 1: Dlandroid ───────────────────────────────────────────────────
async function getDlandroidAPK(query) {
    try {
        const res = await axios.get(
            `https://dlandroid.com/apk/search?q=${encodeURIComponent(query)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        
        // Parse HTML and extract first result
        const html = res.data;
        const linkMatch = html.match(/<a href="\/([^"]+)" class="app-name">/);
        if (linkMatch) {
            const appPath = linkMatch[1];
            const detailRes = await axios.get(`https://dlandroid.com/${appPath}`);
            const detailHtml = detailRes.data;
            
            // Extract download link
            const dlMatch = detailHtml.match(/<a href="(https:\/\/[^"]+\.apk)"/);
            if (dlMatch) {
                return {
                    downloadUrl: dlMatch[1],
                    title: query,
                    icon: null
                };
            }
        }
        return null;
    } catch (err) {
        console.error('[APK] Dlandroid error:', err.message);
        return null;
    }
}

// ─── API 2: APKCombo ───────────────────────────────────────────────────
async function getAPKCombo(query) {
    try {
        const res = await axios.get(
            `https://apkcombo.com/search/?q=${encodeURIComponent(query)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        
        const html = res.data;
        const linkMatch = html.match(/href="\/([^"]+)" class="search-title"/);
        if (linkMatch) {
            const appPath = linkMatch[1];
            const detailRes = await axios.get(`https://apkcombo.com${appPath}`);
            const detailHtml = detailRes.data;
            
            // Extract download link
            const dlMatch = detailHtml.match(/href="(https:\/\/[^"]+\.apk)"/);
            if (dlMatch) {
                return {
                    downloadUrl: dlMatch[1],
                    title: query,
                    icon: null
                };
            }
        }
        return null;
    } catch (err) {
        console.error('[APK] APKCombo error:', err.message);
        return null;
    }
}

// ─── API 3: APKPure (Scraping) ────────────────────────────────────────
async function getAPKPure(query) {
    try {
        const res = await axios.get(
            `https://apkpure.com/search?q=${encodeURIComponent(query)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        
        const html = res.data;
        const linkMatch = html.match(/href="\/([^"]+)" class="search-title"/);
        if (linkMatch) {
            const appPath = linkMatch[1];
            const detailRes = await axios.get(`https://apkpure.com/${appPath}`);
            const detailHtml = detailRes.data;
            
            // Extract download link
            const dlMatch = detailHtml.match(/href="(https:\/\/[^"]+\.apk)"/);
            if (dlMatch) {
                return {
                    downloadUrl: dlMatch[1],
                    title: query,
                    icon: null
                };
            }
        }
        return null;
    } catch (err) {
        console.error('[APK] APKPure error:', err.message);
        return null;
    }
}

// ─── API 4: APKMirror ──────────────────────────────────────────────────
async function getAPKMirror(query) {
    try {
        const res = await axios.get(
            `https://www.apkmirror.com/?s=${encodeURIComponent(query)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        
        const html = res.data;
        const linkMatch = html.match(/href="(https:\/\/www\.apkmirror\.com\/apk\/[^"]+)"/);
        if (linkMatch) {
            const appUrl = linkMatch[1];
            const detailRes = await axios.get(appUrl);
            const detailHtml = detailRes.data;
            
            // Extract download link
            const dlMatch = detailHtml.match(/href="(https:\/\/[^"]+\.apk)"/);
            if (dlMatch) {
                return {
                    downloadUrl: dlMatch[1],
                    title: query,
                    icon: null
                };
            }
        }
        return null;
    } catch (err) {
        console.error('[APK] APKMirror error:', err.message);
        return null;
    }
}

// ─── API 5: APKDownload (Custom API) ──────────────────────────────────
async function getAPKDownload(query) {
    try {
        // Using a free APK API
        const res = await axios.get(
            `https://api.apkdownload.com/search?q=${encodeURIComponent(query)}`,
            { 
                timeout: 15000,
                headers: { 'Accept': 'application/json' }
            }
        );
        
        if (res.data && res.data.results && res.data.results.length > 0) {
            const app = res.data.results[0];
            return {
                downloadUrl: app.download_url || app.url,
                title: app.title || query,
                icon: app.icon || null
            };
        }
        return null;
    } catch (err) {
        console.error('[APK] APKDownload error:', err.message);
        return null;
    }
}

// ─── Main Command ─────────────────────────────────────────────────────────
async function apkCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: '📱 *APK Downloader*\n\nUsage: *.apk <app name>*\nExample: .apk whatsapp\n\n🔍 Search karo aur direct APK download karo!'
            }, { quoted: message });
        }

        // Send loading message
        const loadingMsg = await sock.sendMessage(chatId, {
            text: `🔍 *Searching:* ${searchQuery}\n${LOADING_FRAMES[0]}`
        }, { quoted: message });

        const editLoading = async (frameIdx, label) => {
            try {
                await sock.sendMessage(chatId, {
                    text: `🔍 *${label}*\n${LOADING_FRAMES[frameIdx]}`,
                    edit: loadingMsg.key
                });
            } catch { /* ignore */ }
        };

        const apis = [
            { name: 'Dlandroid', fn: () => getDlandroidAPK(searchQuery) },
            { name: 'APKCombo', fn: () => getAPKCombo(searchQuery) },
            { name: 'APKPure', fn: () => getAPKPure(searchQuery) },
            { name: 'APKMirror', fn: () => getAPKMirror(searchQuery) },
            { name: 'APKDownload', fn: () => getAPKDownload(searchQuery) }
        ];

        await editLoading(1, 'Searching APIs');

        let appData = null;

        for (const api of apis) {
            try {
                console.log(`[APK] Trying ${api.name}...`);
                appData = await api.fn();
                if (appData?.downloadUrl) {
                    console.log(`[APK] ${api.name} success: ${appData.title}`);
                    break;
                }
            } catch (err) {
                console.log(`[APK] ${api.name} failed: ${err.message}`);
            }
        }

        if (!appData?.downloadUrl) {
            try {
                await sock.sendMessage(chatId, {
                    text: '❌ APK nahi mila. Koi API kaam nahi kar rahi.\n\n💡 Tips:\n• Saheeh naam likhein\n• Kuch der baad try karein\n• Google Play link bhi de sakte hain',
                    edit: loadingMsg.key
                });
            } catch {
                await sock.sendMessage(chatId, {
                    text: '❌ APK nahi mila. Dobara try karo.'
                }, { quoted: message });
            }
            return;
        }

        await editLoading(2, `Found: ${appData.title.substring(0, 40)}`);

        // Download APK
        console.log(`[APK] Downloading from: ${appData.downloadUrl}`);
        await editLoading(3, `Downloading APK...`);

        const AXIOS_CONFIG = {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: 100 * 1024 * 1024, // 100MB
            maxBodyLength: 100 * 1024 * 1024,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            }
        };

        const dlRes = await axios.get(appData.downloadUrl, AXIOS_CONFIG);
        const apkBuffer = Buffer.from(dlRes.data);

        if (!apkBuffer?.length || apkBuffer.length < 1024) {
            await sock.sendMessage(chatId, {
                text: '❌ APK file download nahi hua. File size bahut chhoti hai.',
                edit: loadingMsg.key
            });
            return;
        }

        // Check if it's really an APK
        const isAPK = apkBuffer.toString('hex', 0, 4) === '504b0304' || // ZIP header
                      apkBuffer.toString('hex', 0, 4) === '504b0506' || // ZIP64
                      apkBuffer.toString('ascii', 0, 4) === 'PK\x03\x04';

        if (!isAPK && apkBuffer.length > 5000000) {
            // If not an APK but large file, might still be valid
            console.log('[APK] Warning: File may not be APK format');
        }

        await editLoading(4, `Ready! ${(apkBuffer.length / 1024 / 1024).toFixed(1)} MB`);

        // Format app name for filename
        const safeName = appData.title.replace(/[^\w\s\-]/g, '').trim().substring(0, 50);
        const fileName = `${safeName}.apk`;

        // Send APK file
        await sock.sendMessage(chatId, {
            document: apkBuffer,
            mimetype: 'application/vnd.android.package-archive',
            fileName: fileName,
            caption: `📱 *${appData.title}*\n📦 Size: ${(apkBuffer.length / 1024 / 1024).toFixed(2)} MB\n\n⬇️ Download karne ke liye click karein`
        }, { quoted: message });

        // Send small size warning if needed
        if (apkBuffer.length < 1024 * 1024) {
            await sock.sendMessage(chatId, {
                text: '⚠️ *Note:* APK size bahut chhoti hai (1MB se kam). Ye sahi file nahi bhi ho sakti.'
            }, { quoted: message });
        }

    } catch (err) {
        console.error('[APK] Command error:', err.message);
        
        let errorMsg = '❌ APK download mein error aya.\n';
        if (err.response?.status === 404) {
            errorMsg += 'APK nahi mila. App ka naam saheeh likhein.';
        } else if (err.code === 'ECONNABORTED') {
            errorMsg += 'Timeout! Server slow hai. Dobara try karo.';
        } else if (err.response?.status === 403) {
            errorMsg += 'Access denied. Kuch der baad try karo.';
        } else {
            errorMsg += `_${err.message}_`;
        }
        
        await sock.sendMessage(chatId, {
            text: errorMsg
        }, { quoted: message });
    }
}

module.exports = apkCommand;
