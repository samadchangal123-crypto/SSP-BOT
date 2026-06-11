require('dotenv').config();

const settings = {
  packname: 'RDX BOT',
  author: 'RDX BOT',
  botName: process.env.BOT_NAME || "✦ 𝑹𝑫𝑿 𝑩𝑶𝑻 ✦",
  botOwner: 'RDX BOT',
  ownerNumber: process.env.OWNER_NUMBER
    ? process.env.OWNER_NUMBER.split(',').map(n => n.trim().replace(/[^0-9]/g, ''))
    : ['923301068874', '923191852893', '447845666935'],
  prefix: process.env.PREFIX || '.',
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: process.env.BOT_MODE || "public",
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: "This is a bot for managing group commands and automating tasks.",
  version: "3.0.6",
  updateZipUrl: "not yet",
};

module.exports = settings;
