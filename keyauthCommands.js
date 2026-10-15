const crypto = require('node:crypto');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config.json');
const keyauth = require('./keyauth');
const { baseEmbed, COLORS, isRoloStaff } = require('./utils');

function genPassword() {
  return crypto.randomBytes(6).toString('base64url');
}

function accountData(name, desc) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(desc)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((o) => o.setName('username').setDescription('KeyAuth username for the customer').setRequired(true))
    .addIntegerOption((o) => o.setName('days').setDescription('License length in days').setRequired(false).setMinValue(1).setMaxValue(3650))
    .addStringOption((o) => o.setName('subscription').setDescription('KeyAuth subscription name').setRequired(false))
    .addStringOption((o) => o.setName('password').setDescription('Password (auto-generated if empty)').setRequired(false))
    .addUserOption((o) => o.setName('user').setDescription('Discord user to DM the credentials to').setRequired(false));
}

async function createExecute(i) {
  if (!isRoloStaff(i.member)) return i.reply({ content: 'Only the Rolo staff role can use this command.', ephemeral: true });
  await i.deferReply({ ephemeral: true });

  const username = i.options.getString('username', true).trim();
  const days = i.options.getInteger('days') || (config.KEYAUTH && config.KEYAUTH.DEFAULT_EXPIRY_DAYS) || 30;
  const sub = i.options.getString('subscription') || (config.KEYAUTH && config.KEYAUTH.DEFAULT_SUBSCRIPTION) || 'default';
  const pass = i.options.getString('password') || genPassword();
  const target = i.options.getUser('user');

  const r = await keyauth.createUser({ username, password: pass, subscription: sub, expiryDays: days });
  if (!r.ok) return i.editReply(`\u274C ${r.error}`);
  if (!r.data || !r.data.success) return i.editReply(`\u274C KeyAuth rejected the request: ${(r.data && r.data.message) || 'unknown error'}`);

  const embed = baseEmbed(COLORS.GREEN)
    .setTitle('\u2705 KeyAuth Account Created')
    .setDescription('The license/account has been created in KeyAuth. Give the customer their credentials.')
    .addFields(
      { name: 'Username', value: `\`${username}\``, inline: true },
      { name: 'Password', value: `\`${pass}\``, inline: true },
      { name: 'Subscription', value: `\`${sub}\``, inline: true },
      { name: 'Expiry', value: `**${days}** days`, inline: true },
      { name: 'Created by', value: `${i.user.tag}`, inline: true },
    );

  if (target) {
    target.send({ content: '\u{1F4E6} Your Rolo External account:', embeds: [embed] }).catch(() => {});
  }

  return i.editReply({ content: target ? `Credentials created and sent to **${target.tag}** (if their DMs are open).` : undefined, embeds: [embed] });
}

module.exports = [
  {
    data: accountData('createaccount', 'Create a KeyAuth account/license for a customer.'),
    execute: createExecute,
  },
  {
    data: accountData('makeaccount', 'Create a KeyAuth account/license for a customer (alias).'),
    execute: createExecute,
  },
  {
    data: new SlashCommandBuilder()
      .setName('resethwid')
      .setDescription("Reset a KeyAuth user's HWID lock so they can log in on a new device.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false)
      .addStringOption((o) => o.setName('username').setDescription('KeyAuth username to reset').setRequired(true))
      .addUserOption((o) => o.setName('user').setDescription('Discord user to notify').setRequired(false)),
    async execute(i) {
      if (!isRoloStaff(i.member)) return i.reply({ content: 'Only the Rolo staff role can use this command.', ephemeral: true });
      await i.deferReply({ ephemeral: true });

      const username = i.options.getString('username', true).trim();
      const target = i.options.getUser('user');

      const r = await keyauth.resetHwid(username);
      if (!r.ok) return i.editReply(`\u274C ${r.error}`);
      if (!r.data || !r.data.success) return i.editReply(`\u274C KeyAuth rejected the request: ${(r.data && r.data.message) || 'unknown error'}`);

      if (target) {
        target.send({ content: `\u2705 Your HWID was reset for KeyAuth account **${username}**. You can log in on your new device now.` }).catch(() => {});
      }

      return i.editReply({
        embeds: [
          baseEmbed(COLORS.GREEN)
            .setTitle('\u2705 HWID Reset')
            .addFields(
              { name: 'Username', value: `\`${username}\``, inline: true },
              { name: 'Reset by', value: `${i.user.tag}`, inline: true },
            ),
        ],
      });
    },
  },
];