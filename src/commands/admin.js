const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');
const tickets = require('../tickets');
const settings = require('../settings');
const { baseEmbed, COLORS, isRoloStaff } = require('../utils');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('ticketpanel')
      .setDescription('Post the support ticket panel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),
    async execute(i) {
      if (!isRoloStaff(i.member)) return i.reply({ content: 'Only the Rolo staff role can use this command.', ephemeral: true });
      await i.channel.send(tickets.buildPanel());
      return i.reply({ content: '\u2705 Ticket panel posted.', ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('automod')
      .setDescription('Enable, disable or check AutoMod.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false)
      .addStringOption((o) =>
        o
          .setName('state')
          .setDescription('What to do')
          .setRequired(true)
          .addChoices(
            { name: 'enable', value: 'enable' },
            { name: 'disable', value: 'disable' },
            { name: 'status', value: 'status' },
          ),
      ),
    async execute(i) {
      if (!isRoloStaff(i.member)) return i.reply({ content: 'Only the Rolo staff role can use this command.', ephemeral: true });
      const state = i.options.getString('state', true);
      if (state === 'status') {
        return i.reply({
          embeds: [baseEmbed(COLORS.BLUE).setDescription(`AutoMod is currently **${settings.get('automod') ? 'enabled' : 'disabled'}**.`)],
          ephemeral: true,
        });
      }
      settings.set('automod', state === 'enable');
      return i.reply({
        embeds: [
          baseEmbed(state === 'enable' ? COLORS.GREEN : COLORS.RED).setDescription(`AutoMod has been **${state === 'enable' ? 'enabled' : 'disabled'}**.`),
        ],
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('gofileset')
      .setDescription('Set the gofile download link used by /download and /downloadlink.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false)
      .addStringOption((o) => o.setName('link').setDescription('The new gofile link').setRequired(false))
      .addBooleanOption((o) => o.setName('reset').setDescription('Reset back to the link in config.json').setRequired(false)),
    async execute(i) {
      if (!isRoloStaff(i.member)) return i.reply({ content: 'Only the Rolo staff role can use this command.', ephemeral: true });

      if (i.options.getBoolean('reset')) {
        settings.set('gofileLink', null);
        return i.reply({
          embeds: [baseEmbed(COLORS.ORANGE).setDescription(`\u{1F504} Download link reset to the config default:\n${config.DOWNLOAD_LINK}`)],
          ephemeral: true,
        });
      }

      const link = i.options.getString('link');
      if (!link) return i.reply({ content: 'Provide a `link` or use `reset:true`.', ephemeral: true });
      const clean = link.trim();
      if (!/^https?:\/\//i.test(clean)) return i.reply({ content: 'That does not look like a valid URL (must start with http/https).', ephemeral: true });

      settings.set('gofileLink', clean);
      return i.reply({
        embeds: [
          baseEmbed(COLORS.GREEN).setDescription(`\u2705 Download link updated:\n${clean}\n\nCustomers now get this link from \`/download\` and \`/downloadlink\`.`),
        ],
        ephemeral: true,
      });
    },
  },
];