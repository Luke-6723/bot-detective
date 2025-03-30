// Import .env
const { Api } = require("@top-gg/sdk");
const { Client, Message, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { config } = require("dotenv");
config();

const discordToken = process.env.DISCORD_TOKEN;
const detectiveChannelId = process.env.BOT_DETECTIVE_CHANNEL_ID;
const topggAPIToken = process.env.TOP_GG_API_TOKEN;

if (!discordToken) throw Error('No bot token provided');
if (!detectiveChannelId) throw Error('No detectiveChannelId provided');
if (!topggAPIToken) throw Error('No topggAPIToken provided');

const topggApi = new Api(topggAPIToken);
const client = new Client({
  intents: [
    "Guilds",
    "GuildMessages",
    "MessageContent"
  ]
});

client.on('messageCreate', async (msg) => {
  const isThread = msg.channel.isThread();
  let originalChannelId = isThread ? (await msg.channel.fetchStarterMessage()).channelId : msg.channelId;

  if (originalChannelId !== detectiveChannelId) return;
  if (msg.author.bot) return;
  if (!msg.content) return; // Just incase only images are sent.

  if (isThread) {
    const requestAuthorId = (await msg.channel.fetchStarterMessage()).author.id;
    const topGgLinkRegex = /https:\/\/top\.gg\/bot\/(\d{1,32})/m;

    const matches = msg.content.match(topGgLinkRegex);

    if (!matches) return;
    if (matches || matches.length > 1) {
      const botId = matches[1];

      const botData = await topggApi.getBot(botId).catch(_ => null); // Fetch bot from top.gg

      if (!botData) return;

      const row = new ActionRowBuilder();

      const acceptButton = new ButtonBuilder()
        .setCustomId(`approve-${botId}-${originalChannelId}-${msg.author.id}`)
        .setStyle(ButtonStyle.Success)
        .setLabel('Accept');

      const declineButton = new ButtonBuilder()
        .setCustomId(`decline-${botId}-${originalChannelId}-${msg.author.id}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Decline');

      const components = [acceptButton, declineButton];
      row.addComponents(components);


      const embed = new EmbedBuilder()
        .setColor(0xff3366) // Red border
        .setAuthor({
          name: botData.username,
          iconURL: botData.avatar
        })
        .setDescription(botData.shortdesc || "")
        .addFields({ name: "Server Count", value: `${botData.server_count.toLocaleString()}`, inline: true })
        .addFields({ name: "Monthly Votes", value: `${botData.monthlyPoints.toLocaleString()}`, inline: true })
        .addFields({ name: "Total Votes", value: `${botData.points.toLocaleString()}`, inline: true })
        .addFields({ name: "Tags", value: botData.tags.splice(0, 3).join(', '), inline: false })
        .setTimestamp();

      msg.reply({ content: `<@${requestAuthorId}> a new suggestion has come in:`, embeds: [embed], components: [row]});
    } else return;
  } else {
    const thread = await msg.startThread({ name: "Bot detective at work:" });
    await thread.send({
      embeds: [
        {
          description: `# **Help this user find their desired bot!**
## Please send your recommendations here.

### Include a [Top.gg](https://top.gg) link in order for us to find the useful information.
### Only one link at a time please.
  
### :detective: Good luck!`
        }
      ]
    });
  }
});

client.on('interactionCreate', (interaction) => {

});

client.on('ready', () => {
  console.log('Detective is detectivating.');
});

client.login(discordToken);