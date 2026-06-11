const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');


async function githubCommand(sock, chatId, message) {
  try {
    let txt = `*乂  RDX BOT  乂*\n\n`;
    txt += `✩  *Name* : RDX BOT\n`;
    txt += `✩  *Watchers* : 100+\n`;
    txt += `✩  *Size* : 15.5 MB\n`;
    txt += `✩  *Last Updated* : ${moment().format('DD/MM/YY - HH:mm:ss')}\n`;
    txt += `✩  *URL* : not yet\n`;
    txt += `✩  *Forks* : 50+\n`;
    txt += `✩  *Stars* : 200+\n\n`;
    txt += `💥 *RDX BOT*`;

    // Use the local asset image
    const images = ['RDX1.jpg', 'RDX2.jpg', 'RDX3.jpg', 'RDX4.jpg', 'RDX5.jpg', 'RDX6.jpg'];
    const randomImage = images[Math.floor(Math.random() * images.length)];
    const imgPath = path.join(__dirname, '../assets', randomImage);
    const imgBuffer = fs.readFileSync(imgPath);

    await sock.sendMessage(chatId, { image: imgBuffer, caption: txt }, { quoted: message });
  } catch (error) {
    await sock.sendMessage(chatId, { text: '❌ Error fetching repository information.' }, { quoted: message });
  }
}

module.exports = githubCommand; 