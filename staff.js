const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const tickets = require('./tickets');
const transcript = require('./transcript');
const { baseEmbed, COLORS, isRoloStaff } = require('./utils');

function staffOnly(i) {
  if (!isRoloStaff(i.member)) {
    i.reply({ content: 'Only the Rolo staff role can use this command.', ephemeral: true });
    return false;
  }
  return true;
}

function openerFrom(channel, meta) {
  return (meta && meta.openerId) || (channel.topic && channel.topic.match(/opener:(\d+)/)?.[1]) || null;
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('close').setDescription('Close this ticket (staff or ticket opener).').setDMPermission(false),
    async execute(i, client) {
      const meta = tickets.getMeta(i.channel.id);
      const openerId = openerFrom(i.channel, meta);
      if (!isRoloStaff(i.member) && openerId !== i.user.id) {
        return i.reply({ content: 'Only staff or the ticket opener can close this ticket.', ephemeral: true });
      }
      if (!meta && !(i.channel.name || '').startsWith('ticket')) {
        return i.reply({ content: 'This does not look like a ticket channel.', ephemeral: true });
      }
      await i.deferReply({ ephemeral: true });
      await tickets.closeTicket(i.channel, i.guild, i.user, meta, client);
      return i.editReply('\u{1F512} Closing ticket...');
    },
  },
  {
    data: new SlashCommandBuilder().setName('lock').setDescription('Lock this ticket (staff only).').setDMPermission(false),
    async execute(i) {
      if (!staffOnly(i)) return;
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone.id, { SendMessages: false }).catch(() => {});
      return i.reply({ embeds: [baseEmbed(COLORS.ORANGE).setDescription('\u{1F512} This ticket is now **locked**. Staff only.')] });
    },
  },
  {
    data: new SlashCommandBuilder().setName('unlock').setDescription('Unlock this ticket.').setDMPermission(false),
    async execute(i) {
      if (!staffOnly(i)) return;
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone.id, { SendMessages: true }).catch(() => {});
      return i.reply({ embeds: [baseEmbed(COLORS.GREEN).setDescription('\u{1F513} This ticket is now **unlocked**.')] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('adduser')
      .setDescription('Add a user to this ticket.')
      .setDMPermission(false)
      .addUserOption((o) => o.setName('user').setDescription('User to add').setRequired(true)),
    async execute(i) {
      if (!staffOnly(i)) return;
      const user = i.options.getUser('user', true);
      await i.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true }).catch(() => {});
      return i.reply({ embeds: [baseEmbed(COLORS.GREEN).setDescription(`\u2705 Added <@${user.id}> to this ticket.`)] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('removeuser')
      .setDescription('Remove a user from this ticket.')
      .setDMPermission(false)
      .addUserOption((o) => o.setName('user').setDescription('User to remove').setRequired(true)),
    async execute(i) {
      if (!staffOnly(i)) return;
      const user = i.options.getUser('user', true);
      await i.channel.permissionOverwrites.delete(user.id).catch(() => {});
      return i.reply({ embeds: [baseEmbed(COLORS.RED).setDescription(`\u274C Removed <@${user.id}> from this ticket.`)] });
    },
  },
  {
    data: new SlashCommandBuilder().setName('transcript').setDescription('Generate a txt transcript of this ticket.').setDMPermission(false),
    async execute(i) {
      if (!staffOnly(i)) return;
      const meta = tickets.getMeta(i.channel.id);
      const openerId = openerFrom(i.channel, meta);
      await i.deferReply({ ephemeral: true });

      const text = await transcript.build(i.channel, {
        category: (meta && meta.category) || 'Support',
        openerId,
        openedAt: (meta && meta.openedAt) || i.channel.createdTimestamp,
        closedBy: `${i.user.tag} (manual export)`,
      });
      const file = transcript.save(i.channel, text);

      if (openerId) {
        const opener = await i.guild.members.fetch(openerId).catch(() => null);
        if (opener) opener.send({ content: '\u{1F4DC} Transcript for your Rolo External ticket:', files: [file] }).catch(() => {});
      }

      return i.editReply({ content: '\u{1F4DC} Transcript generated' + (openerId ? ' and DM\u2019d to the ticket opener.' : '.'), files: [file] });
    },
  },
];