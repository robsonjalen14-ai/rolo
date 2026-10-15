const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config.json');
const settings = require('./settings');
const { baseEmbed, COLORS, isCustomer } = require('./utils');

/** Link set via /gofileset wins, otherwise falls back to config.json. */
function currentLink() {
  return settings.get('gofileLink') || config.DOWNLOAD_LINK;
}

function checkAccess(i) {
  if (config.REQUIRE_CUSTOMER_ROLE_FOR_DOWNLOADS && !isCustomer(i.member)) {
    i.reply({ content: 'You need the **Customer** role to use this command.', ephemeral: true });
    return false;
  }
  return true;
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('download').setDescription('Get the Rolo External download link (only you can see it).'),
    async execute(i) {
      if (!checkAccess(i)) return;
      const link = currentLink();
      const embed = baseEmbed(COLORS.BLUE)
        .setTitle('\u{2B07}\uFE0F Rolo External \u2022 Download')
        .setDescription(`Here is your download link:\n\n\u{1F517} ${link}${config.DOWNLOAD_PASSWORD ? `\n\n**Password:** \`${config.DOWNLOAD_PASSWORD}\`` : ''}\n\nIf the link is dead, open a **Customer** ticket and staff will re-upload it.`)
        .setTimestamp(null);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Download').setStyle(ButtonStyle.Link).setURL(link),
      );
      return i.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder().setName('downloadlink').setDescription('Get the raw download link (only you can see it).'),
    async execute(i) {
      if (!checkAccess(i)) return;
      return i.reply({ content: currentLink(), ephemeral: true });
    },
  },
];