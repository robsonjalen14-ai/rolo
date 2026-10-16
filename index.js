const { Client, GatewayIntentBits, Partials, Events, ActivityType } = require('discord.js');
const config = require('./config.json');
const commands = require('./commands');
const tickets = require('./tickets');
const automod = require('./automod');
const settings = require('./settings');
const transcript = require('./transcript');
const verify = require('./verify');
const webserver = require('./webserver');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
});

client.config = config;

client.once(Events.ClientReady, async (c) => {
  try {
    const list = commands.array();
    const guild = c.guilds.cache.get(config.GUILD_ID);
    if (guild) {
      await guild.commands.set(list);
      console.log(`[cmds] Registered ${list.length} commands in ${guild.name}`);
    } else {
      await c.application.commands.set(list);
      console.log(`[cmds] Registered ${list.length} global commands (GUILD_ID not in cache)`);
    }
  } catch (e) {
    console.error('[cmds] Failed to register commands:', e);
  }

  const status = config.STATUS || 'dnd';
  c.user.setPresence({
    status,
    activities: [{ name: config.ACTIVITY_NAME || 'Made By Rolo .gg/rolo', type: ActivityType.Watching }],
  });

  if (config.SET_AVATAR_ON_START) {
    const fs = require('node:fs');
    const path = require('node:path');
    const file = path.resolve(__dirname, '..', 'assets', 'avatar.png');
    if (fs.existsSync(file)) {
      await c.user.setAvatar(file).then(() => console.log('[ready] Avatar updated from assets/avatar.png')).catch((e) => console.error('[ready] Avatar update failed:', e.message));
    }
  }

  console.log(`[ready] ${config.BOT_NAME} logged in as ${c.user.tag} | status: ${status}`);

  verify.setClient(c);
  webserver.start();

  if (config.KEYAUTH && config.KEYAUTH.NAME) {
    const keyauth = require('./keyauth');
    const ka = await keyauth.init();
    if (ka.ok) {
      console.log(`[keyauth] App "${config.KEYAUTH.NAME}" initialised (session ${ka.session.id})`);
    } else {
      console.error(`[keyauth] ${ka.error}`);
    }
  }
});

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      const cmd = commands.get(i.commandName);
      if (!cmd) return;
      await cmd.execute(i, client);
    } else if (i.isButton() && i.customId === 'verify:button') {
      await verify.handleButton(i);
    } else if (i.isStringSelectMenu() && i.customId.startsWith('ticket:')) {
      await tickets.handleSelect(i, client);
    } else if (i.isButton() && i.customId.startsWith('ticket-')) {
      await tickets.handleButton(i, client);
    }
  } catch (e) {
    console.error('[interaction]', e);
    const payload = { content: 'Something went wrong running that command. Please try again.', ephemeral: true };
    try {
      if (i.deferred || i.replied) await i.followUp(payload);
      else await i.reply(payload);
    } catch {}
  }
});

client.on(Events.MessageCreate, (m) => {
  if (m.guild) transcript.track(m);
  automod.handle(m, client).catch((e) => console.error('[automod]', e));
});

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

client.login(config.TOKEN).catch((e) => {
  console.error('[login] Failed to login. Check TOKEN in config.json:', e.message);
  process.exit(1);
});