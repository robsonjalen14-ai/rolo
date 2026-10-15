const { SlashCommandBuilder } = require('discord.js');
const config = require('../config.json');
const { baseEmbed, COLORS } = require('../utils');

module.exports = [
  {
    data: new SlashCommandBuilder().setName('ping').setDescription('Check if the bot is alive.'),
    async execute(i) {
      const start = Date.now();
      await i.reply({ embeds: [baseEmbed(COLORS.BLUE).setDescription('\u23F3 Pinging...')] });
      const roundtrip = Date.now() - start;
      return i.editReply({
        embeds: [baseEmbed(COLORS.GREEN).setDescription(`\u2705 Pong! **${roundtrip}ms** roundtrip | **${Math.round(i.client.ws.ping)}ms** gateway`)],
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName('help').setDescription('List all Rolo External Bot commands.'),
    async execute(i) {
      const embed = baseEmbed(COLORS.BLUE)
        .setAuthor({ name: `${config.BOT_NAME} \u2022 Help` })
        .setTitle('\u2753 Command List')
        .addFields(
          {
            name: '\u{1F310} Everyone',
            value: '`/download` - Get the download link (button + link)\n`/downloadlink` - Raw download link\n`/help` - This list\n`/ping` - Bot latency',
          },
          {
            name: '\u{1F6E1}\uFE0F Ticket Staff',
            value: '`/ticketpanel` - Post the ticket panel\n`/close` - Close the ticket\n`/lock` / `/unlock` - Lock the ticket\n`/adduser` / `/removeuser` - Manage access\n`/transcript` - Export a txt transcript',
          },
          {
            name: '\u{1F3ED} Rolo Staff Role Only',
            value: '`/automod` - Enable/disable/status\n`/createaccount` / `/makeaccount` - Create a KeyAuth license\n`/resethwid` - Reset a user HWID',
          },
        )
        .setTimestamp(null);
      return i.reply({ embeds: [embed], ephemeral: true });
    },
  },
];