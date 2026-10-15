const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');

/**
 * One-off script: sets the bot avatar from assets/avatar.png
 * Usage: put the Rolo logo at assets/avatar.png then run "npm run avatar"
 */
(async () => {
  const file = path.resolve(__dirname, 'assets', 'avatar.png');
  if (!fs.existsSync(file)) {
    console.error('Missing assets/avatar.png - save the Rolo logo there first.');
    process.exit(1);
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once('ready', async () => {
    try {
      await client.user.setAvatar(file);
      console.log('Avatar set from assets/avatar.png');
    } catch (e) {
      console.error('Failed to set avatar:', e.message);
    }
    client.destroy();
  });
  await client.login(config.TOKEN).catch((e) => {
    console.error('Login failed, check TOKEN:', e.message);
    process.exit(1);
  });
})();