const { PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');
const settings = require('./settings');
const { COLORS, baseEmbed, isRoloStaff } = require('./utils');

const recentMsgs = new Map();
const strikes = new Map();

const INVITE_REGEX = /(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/[\w-]+/i;
const LINK_REGEX = /https?:\/\//i;

async function handle(msg, client) {
  if (!msg.guild || !msg.author || msg.author.bot) return;
  if (!settings.get('automod')) return;

  const am = config.AUTOMOD || {};
  const member = msg.member || (await msg.guild.members.fetch(msg.author.id).catch(() => null));
  if (am.STAFF_BYPASS && isRoloStaff(member)) return;
  if (member && member.permissions && member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const content = msg.content || '';
  const lower = content.toLowerCase();
  const reasons = [];

  if (am.BLOCK_INVITES && INVITE_REGEX.test(content)) reasons.push('invite link');
  if (am.BLOCK_LINKS && LINK_REGEX.test(content)) reasons.push('external link');
  for (const w of am.BLOCKED_WORDS || []) {
    if (lower.includes(String(w).toLowerCase())) {
      reasons.push(`blocked word (\`${w}\`)`);
      break;
    }
  }
  const mentionCount = msg.mentions.users.size + msg.mentions.roles.size + (msg.mentions.everyone ? 99 : 0);
  if (mentionCount > (am.MAX_MENTIONS || 5)) reasons.push('mass mentions');

  const letters = content.replace(/[^a-z]/gi, '');
  if (letters.length >= (am.CAPS_MIN_LENGTH || 12)) {
    const caps = letters.replace(/[^A-Z]/g, '').length / letters.length;
    if (caps * 100 >= (am.CAPS_PERCENT || 75)) reasons.push('excessive caps');
  }

  const now = Date.now();
  const window = am.SPAM_WINDOW_MS || 6000;
  const arr = (recentMsgs.get(msg.author.id) || []).filter((t) => now - t < window);
  arr.push(now);
  recentMsgs.set(msg.author.id, arr);
  if (arr.length >= (am.SPAM_MESSAGES || 6)) reasons.push('spamming');

  if (!reasons.length) return;

  await msg.delete().catch(() => {});

  const count = (strikes.get(msg.author.id) || 0) + 1;
  strikes.set(msg.author.id, count);
  setTimeout(() => strikes.delete(msg.author.id), 5 * 60 * 1000);

  const maxStrikes = am.STRIKES_BEFORE_TIMEOUT || 3;
  const warn = await msg.channel
    .send({
      content: `<@${msg.author.id}> your message was removed: **${reasons.join(', ')}**. Strike ${count}/${maxStrikes}.`,
    })
    .catch(() => null);
  if (warn) setTimeout(() => warn.delete().catch(() => {}), 6000);

  if (count >= maxStrikes) {
    if (member && member.timeout) {
      await member.timeout((am.TIMEOUT_MINUTES || 10) * 60 * 1000, `AutoMod: ${reasons.join(', ')}`).catch(() => {});
    }
    strikes.delete(msg.author.id);
  }

  const logId = config.AUTOMOD_LOG_CHANNEL_ID;
  const logChannel = logId ? msg.guild.channels.cache.get(logId) : null;
  if (logChannel && logChannel.send) {
    const snippet = content.slice(0, 900).replace(/```/g, '');
    logChannel
      .send({
        embeds: [
          baseEmbed(COLORS.RED)
            .setAuthor({ name: `AutoMod \u2022 ${msg.author.tag}`, iconURL: msg.author.displayAvatarURL() })
            .setDescription(
              `**User:** <@${msg.author.id}>\n**Channel:** <#${msg.channel.id}>\n**Reasons:** ${reasons.join(', ')}\n**Strike:** ${count}/${maxStrikes}\n**Content:**\n\`\`\`${snippet}\`\`\``,
            ),
        ],
      })
      .catch(() => {});
  }
}

module.exports = { handle };