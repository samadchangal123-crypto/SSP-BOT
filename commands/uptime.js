const os = require('os');
const settings = require('../rdx-settings.js');

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

function getMemoryBar(used, total) {
    const percent = Math.round((used / total) * 10);
    const filled = '█'.repeat(percent);
    const empty = '░'.repeat(10 - percent);
    return `${filled}${empty}`;
}

function getHealthStatus(cpuPercent, memPercent) {
    if (cpuPercent < 50 && memPercent < 60) return '🟢 Excellent';
    if (cpuPercent < 75 && memPercent < 80) return '🟡 Good';
    return '🔴 High Load';
}

function getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpus) {
        for (const type in cpu.times) totalTick += cpu.times[type];
        totalIdle += cpu.times.idle;
    }
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = Math.round((1 - idle / total) * 100);
    return isNaN(usage) ? 0 : Math.min(usage, 100);
}

async function uptimeCommand(sock, chatId, message) {
    try {
        const start = Date.now();

        const uptimeSec = process.uptime();
        const uptimeStr = formatUptime(uptimeSec);

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = Math.round((usedMem / totalMem) * 100);
        const usedMB = (usedMem / 1024 / 1024).toFixed(1);
        const totalMB = (totalMem / 1024 / 1024).toFixed(1);
        const memBar = getMemoryBar(usedMem, totalMem);

        const cpuPercent = getCpuUsage();
        const cpuBar = getMemoryBar(cpuPercent, 100);

        const nodeHeap = process.memoryUsage();
        const heapUsedMB = (nodeHeap.heapUsed / 1024 / 1024).toFixed(1);
        const heapTotalMB = (nodeHeap.heapTotal / 1024 / 1024).toFixed(1);

        const ping = Date.now() - start;
        const health = getHealthStatus(cpuPercent, memPercent);
        const platform = os.platform();
        const arch = os.arch();
        const nodeVer = process.version;

        const msg = `╭━━━━━━━━━━━━━━━━━━━━╮
┃   ⏱️ *BOT UPTIME & HEALTH*
╰━━━━━━━━━━━━━━━━━━━━╯

🤖 *Bot:* ${settings.botName}
📦 *Version:* ${settings.version}
⚡ *Ping:* ${ping} ms
🏥 *Health:* ${health}

╭─── ⏱ *UPTIME* ──────────╮
┃ ${uptimeStr}
╰──────────────────────────╯

╭─── 💾 *MEMORY* ──────────╮
┃ RAM   : [${memBar}] ${memPercent}%
┃ Used  : ${usedMB} MB / ${totalMB} MB
┃ Heap  : ${heapUsedMB} MB / ${heapTotalMB} MB
╰──────────────────────────╯

╭─── 🖥 *CPU & SYSTEM* ────╮
┃ CPU   : [${cpuBar}] ${cpuPercent}%
┃ OS    : ${platform} (${arch})
┃ Node  : ${nodeVer}
╰──────────────────────────╯

🤖 *Powered by RDX BOT*`;

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });

    } catch (error) {
        console.error('[uptime] Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Uptime fetch karne mein error aa gaya.' }, { quoted: message });
    }
}

module.exports = uptimeCommand;
