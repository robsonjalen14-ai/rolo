const fs = require('node:fs');
const path = require('node:path');
const { ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');
const { COLORS, baseEmbed, resolvePath, hasRole, isRoloStaff } = require('./utils');
const transcript = require('./transcript');

const openTickets = new Map();

const CATEGORIES = [
  { id: 'partnership', label: 'Partnership', emoji: '\u{1F91D}', description: 'Business partnerships and collaborations', cfgKey: 'partnership' },
  { id: 'enterprise', label: 'Enterprise', emoji: '\u{1F3E2}', description: 'Enterprise solutions and bulk purchases' },
  { id: 'customer', label: 'Customer', emoji: '\u{1F534}', description: 'Customer support (requires Customer role)', roleId: () => config.CUSTOMER_ROLE_ID, cfgKey: 'customer' },
  { id: 'hwid', label: 'HWID Reset', emoji: '\u{1F511}', description: 'Request a KeyAuth HWID reset (requires Customer role)', roleId: () => config.CUSTOMER_ROLE_ID, cfgKey: 'hwid' },
  { id: 'reports', label: 'Cheat/Bypass Reports', emoji: '\u{1F4EE}', description: 'Report detected cheats or bypasses' },
  { id: 'regular', label: 'Regular', emoji: '\u{2753}', description: 'General questions and support' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nextTicketNumber() {
  const file = resolvePath(config.TICKET_COUNTER_FILE || './data/ticketCounter.json');
  let n = 0;
  try {
    n = parseInt(fs.readFileSync(file, 'utf8'), 10) || 0;
  } catch {}
  n += 1;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(n));
  return n;
}

function getMeta(channelId) {
  return openTickets.get(channelId);
}

function staffRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('\u{1F512}'),
    new ButtonBuilder().setCustomId('ticket-claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('\u{2705}'),
    new ButtonBuilder().setCustomId('ticket-transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('\u{1F4DC}'),
  );
}

function buildPanel() {
  const lines = CATEGORIES.map((c) => `${c.emoji} **${c.label}** - ${c.description}`).join('\n');
  const embed = baseEmbed(COLORS.BLUE)
    .setAuthor({ name: `${config.BOT_NAME} \u2022 Support` })
    .setTitle('\u{1F3AB} Create Support Ticket')
    .setDescription(`Need help? Select a category below to create a support ticket.\n\n${lines}\n\nSelect a category from the dropdown below.`)
    .setTimestamp(null);

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket:create')
    .setPlaceholder('Select a ticket category...')
    .addOptions(
      CATEGORIES.map((c) => ({
        label: c.label,
        value: c.id,
        description: c.description.slice(0, 100),
        emoji: { name: c.emoji },
      })),
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}

async function handleSelect(i, client) {
  const choice = CATEGORIES.find((c) => c.id === i.values[0]);
  if (!choice) return i.reply({ content: 'Unknown ticket category.', ephemeral: true });

  const requiredRole = typeof choice.roleId === 'function' ? choice.roleId() : choice.roleId;
  if (requiredRole && !hasRole(i.member, requiredRole)) {
    return i.reply({ content: `You need the required role to open a **${choice.label}** ticket.`, ephemeral: true });
  }

  const already = [...openTickets.values()].some((t) => t.openerId === i.user.id);
  if (already) {
    return i.reply({ content: 'You already have an open ticket. Close it first or ask staff for help.', ephemeral: true });
  }

  await i.deferReply({ ephemeral: true });

  const number = nextTicketNumber();
  const username = i.user.username.replace(/[^\w-]/g, '').slice(0, 20) || 'user';

  let channel;
  try {
    channel = await i.guild.channels.create({
      name: `ticket-${number}-${username}`,
      type: ChannelType.GuildText,
      parent: (config.TICKET_CATEGORY_IDS && config.TICKET_CATEGORY_IDS[choice.cfgKey]) || config.TICKET_CATEGORY_ID || undefined,
      topic: `Ticket #${number} \u2022 ${choice.label} \u2022 opener:${i.user.id}`,
      permissionOverwrites: [
        { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: config.ROLO_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages,
          ],
        },
        {
          id: i.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
    });
  } catch (e) {
    console.error('[ticket] Failed to create channel:', e);
    return i.editReply('\u274C Failed to create the ticket channel. Make sure I have **Manage Channels** and that TICKET_CATEGORY_ID is valid.');
  }

  const embed = baseEmbed(COLORS.BLUE)
    .setAuthor({ name: `${config.BOT_NAME} \u2022 Ticket #${number}`, iconURL: client.user.displayAvatarURL() })
    .setTitle(`${choice.emoji} ${choice.label} Support`)
    .setDescription(`Hey <@${i.user.id}>, thanks for opening a **${choice.label}** ticket. A member of staff will be with you shortly.\n\nDescribe your issue and someone will help you as soon as possible.`)
    .addFields(
      { name: 'Category', value: choice.label, inline: true },
      { name: 'Status', value: '\u{1F7E2} Open', inline: true },
      { name: 'Claimed by', value: 'Not claimed', inline: true },
      { name: 'Opened', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    );

  await channel.send({ content: `<@&${config.ROLO_ROLE_ID}>`, embeds: [embed], components: [staffRow()] }).catch(() => {});

  openTickets.set(channel.id, {
    number,
    openerId: i.user.id,
    category: choice.label,
    openedAt: Date.now(),
    claimedBy: null,
    closing: false,
  });

  return i.editReply(`\u2705 Ticket created: <#${channel.id}>`);
}

async function handleButton(i, client) {
  const meta = openTickets.get(i.channel.id);
  const openerId = (meta && meta.openerId) || (i.channel.topic && i.channel.topic.match(/opener:(\d+)/)?.[1]) || null;
  const staff = isRoloStaff(i.member) || (i.member && i.member.permissions && i.member.permissions.has(PermissionFlagsBits.ManageChannels));
  const isOpener = openerId && openerId === i.user.id;

  if (i.customId === 'ticket-close') {
    if (!staff && !isOpener) return i.reply({ content: 'Only staff or the ticket opener can close this ticket.', ephemeral: true });
    await i.deferReply({ ephemeral: true });
    await closeTicket(i.channel, i.guild, i.user, meta, client);
    return i.editReply('\u{1F512} Ticket closed.');
  }

  if (i.customId === 'ticket-claim') {
    if (!staff) return i.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
    if (!meta) return i.reply({ content: 'This ticket was opened before the bot restarted, so it cannot be claimed here.', ephemeral: true });
    if (meta.claimedBy) return i.reply({ content: `This ticket is already claimed by **${meta.claimedBy}**.`, ephemeral: true });
    meta.claimedBy = i.user.tag;
    const old = i.message.embeds[0];
    const embed = old
      ? EmbedBuilder.from(old).setFields(
          ...(old.fields || []).map((f) => (f.name === 'Claimed by' ? { name: f.name, value: `\`${i.user.tag}\``, inline: true } : { name: f.name, value: f.value, inline: f.inline })),
        )
      : baseEmbed(COLORS.BLUE).setDescription(`Claimed by **${i.user.tag}**`);
    return i.update({ embeds: [embed] });
  }

  if (i.customId === 'ticket-transcript') {
    if (!staff) return i.reply({ content: 'Only staff can generate transcripts.', ephemeral: true });
    await i.deferReply({ ephemeral: true });
    const text = await transcript.build(i.channel, {
      category: (meta && meta.category) || 'Support',
      openerId,
      openedAt: meta && meta.openedAt,
      closedBy: `${i.user.tag} (manual export)`,
    });
    const file = transcript.save(i.channel, text);
    if (openerId) {
      const opener = await i.guild.members.fetch(openerId).catch(() => null);
      if (opener) opener.send({ content: '\u{1F4DC} Transcript for your Rolo External ticket:', files: [file] }).catch(() => {});
    }
    return i.editReply({ content: '\u{1F4DC} Transcript generated and DM\u2019d to the ticket opener.', files: [file] });
  }
}

async function closeTicket(channel, guild, closedBy, meta, client) {
  if (meta && meta.closing) return;
  if (meta) meta.closing = true;

  const openerId = (meta && meta.openerId) || (channel.topic && channel.topic.match(/opener:(\d+)/)?.[1]) || null;
  const category = (meta && meta.category) || 'Support';

  await channel
    .send({
      embeds: [
        baseEmbed(COLORS.RED)
          .setDescription(`\u{1F512} This ticket was closed by **${closedBy.tag}**. The transcript has been saved and sent to the ticket opener.`)
          .setTimestamp(),
      ],
    })
    .catch(() => {});

  const text = await transcript.build(channel, { category, openerId, openedAt: meta && meta.openedAt, closedBy: closedBy.tag });
  const file = transcript.save(channel, text);

  if (openerId) {
    const opener = await guild.members.fetch(openerId).catch(() => null);
    if (opener) {
      opener
        .send({
          content: `\u{1F4DC} Your **${category}** ticket (#${(meta && meta.number) || '\u2014'}) has been closed. Transcript attached.`,
          files: [file],
        })
        .catch(() => {});
    }
  }

  const logId = config.TRANSCRIPT_LOG_CHANNEL_ID;
  const logChannel = logId ? guild.channels.cache.get(logId) : null;
  if (logChannel && logChannel.send) {
    logChannel
      .send({
        embeds: [
          baseEmbed(COLORS.BLUE).setTitle(`\u{1F4CB} Transcript \u2022 ${channel.name}`).addFields(
            { name: 'Category', value: category, inline: true },
            { name: 'Opener', value: openerId ? `<@${openerId}>` : 'Unknown', inline: true },
            { name: 'Closed by', value: closedBy.tag, inline: true },
          ),
        ],
        files: [file],
      })
      .catch(() => {});
  }

  openTickets.delete(channel.id);

  if (config.DELETE_TICKET_ON_CLOSE) {
    await sleep(4000);
    await channel.delete().catch(() => {});
  } else {
    await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: true, SendMessages: false }).catch(() => {});
    if (openerId) await channel.permissionOverwrites.edit(openerId, { ViewChannel: true, SendMessages: false }).catch(() => {});
  }
}

module.exports = { buildPanel, handleSelect, handleButton, closeTicket, getMeta, CATEGORIES };