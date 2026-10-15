const path = require('node:path');
const { EmbedBuilder } = require('discord.js');
const config = require('./config.json');

const COLORS = {
  BLUE: 0x2f6bff,
  GREEN: 0x2ecc71,
  RED: 0xe74c3c,
  ORANGE: 0xe67e22,
  GREY: 0x95a5a6,
  DARK: 0x11151c,
};

/** Resolve a path relative to the bot project root. */
function resolvePath(p) {
  return path.resolve(__dirname, String(p).replace(/^\.?[\\/]/, ''));
}

function hasRole(member, roleId) {
  if (!member || !roleId) return false;
  if (member.roles && member.roles.cache && typeof member.roles.cache.has === 'function') {
    return member.roles.cache.has(roleId);
  }
  if (Array.isArray(member.roles)) return member.roles.includes(roleId);
  return false;
}

function isRoloStaff(member) {
  return hasRole(member, config.ROLO_ROLE_ID);
}

function isCustomer(member) {
  return hasRole(member, config.CUSTOMER_ROLE_ID);
}

function baseEmbed(color = COLORS.BLUE) {
  return new EmbedBuilder().setColor(color).setFooter({ text: 'Made By Rolo  |  .gg/rolo' }).setTimestamp();
}

module.exports = { COLORS, resolvePath, hasRole, isRoloStaff, isCustomer, baseEmbed, config };