const crypto = require('node:crypto');
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('./config.json');
const { baseEmbed, COLORS, isRoloStaff } = require('./utils');

/** state -> { userId, ip, expires } for in-flight verifications */
const pending = new Map();
let clientRef = null;

function setClient(c) {
  clientRef = c;
}

function cleanup() {
  for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
}

function makeState(userId) {
  cleanup();
  const state = crypto.randomBytes(24).toString('hex');
  pending.set(state, { userId, ip: null, expires: Date.now() + 15 * 60 * 1000 });
  return state;
}

function getState(state) {
  const e = pending.get(state);
  if (!e) return null;
  if (e.expires < Date.now()) {
    pending.delete(state);
    return null;
  }
  return e;
}

function setStateIp(state, ip) {
  const e = getState(state);
  if (e) {
    e.ip = ip;
    pending.set(state, e);
  }
}

function consumeState(state) {
  const e = getState(state);
  pending.delete(state);
  return e;
}

function publicUrl() {
  return ((config.WEB && config.WEB.PUBLIC_URL) || '').replace(/\/+$/, '');
}

function callbackUrl() {
  return `${publicUrl()}/callback`;
}

function authorizeUrl(state) {
  const u = new URL('https://discord.com/oauth2/authorize');
  u.searchParams.set('client_id', config.CLIENT_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'identify');
  u.searchParams.set('redirect_uri', callbackUrl());
  u.searchParams.set('state', state);
  return u.toString();
}

/** Grants the Verified role to a Discord user (called by the web server in-process). */
async function grantRole(userId) {
  if (!config.VERIFY_ROLE_ID) return { ok: false, reason: 'VERIFY_ROLE_ID not set in config.json' };
  if (!clientRef) return { ok: false, reason: 'Bot not ready yet' };
  try {
    let guild = clientRef.guilds.cache.get(config.GUILD_ID);
    if (!guild) guild = await clientRef.guilds.fetch(config.GUILD_ID);
    const member = await guild.members.fetch(userId);
    await member.roles.add(config.VERIFY_ROLE_ID);
    return { ok: true, tag: member.user.tag };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function buildPanel() {
  const embed = baseEmbed(COLORS.BLUE)
    .setAuthor({ name: `${config.BOT_NAME} \u2022 Verification` })
    .setTitle('\u2705 Verification Required')
    .setDescription(
      `Click the button below to get full access.\n\nYou will be sent to a short page and asked to **continue with Discord**. Once finished, you get the **Verified** role instantly.\n\n**Why:** verification links one Discord account per person and records your IP for anti-fraud. By continuing you agree to that.`,
    )
    .setTimestamp(null);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify:button').setLabel('Verify').setStyle(ButtonStyle.Success).setEmoji('\u2705'),
  );
  return { embeds: [embed], components: [row] };
}

async function handleButton(i) {
  if (!publicUrl()) {
    return i.reply({ content: 'Verification is not configured yet - `WEB.PUBLIC_URL` is missing in config.json.', ephemeral: true });
  }
  const state = makeState(i.user.id);
  return i.reply({
    content: `**${config.BOT_NAME} \u2022 Verification**\n\n${publicUrl()}/verify?state=${state}\n\nOpen the link and press **Continue with Discord**. The link expires in 15 minutes.`,
    ephemeral: true,
  });
}

module.exports = { setClient, makeState, getState, setStateIp, consumeState, publicUrl, callbackUrl, authorizeUrl, grantRole, buildPanel, handleButton };