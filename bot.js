// Import .env
const { Api } = require("@top-gg/sdk");
const { Client, Message, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { config } = require("dotenv");
const { PrismaClient } = require('@prisma/client');
config();

const discordToken = process.env.DISCORD_TOKEN;
const detectiveChannelId = process.env.BOT_DETECTIVE_CHANNEL_ID;
const topggAPIToken = process.env.TOP_GG_API_TOKEN;
const botDetectiveRoleId = process.env.BOT_DETECTIVE_ROLE_ID;

const database = new PrismaClient();

const embedColour = 0xff3366;

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
  const requestAuthorId = isThread ? (await msg.channel.fetchStarterMessage().catch(_ => { return {}; }))?.author.id : msg.author.id;
  let originalMessageId = isThread ? (await msg.channel.fetchStarterMessage().catch(_ => { return {}; }))?.id : msg.id;
  let originalChannelId = isThread ? (await msg.channel.fetchStarterMessage().catch(_ => { return {}; }))?.channelId : msg.channelId;

  if (originalChannelId !== detectiveChannelId) return;
  if (msg.author.bot) return;
  if (!msg.content) return; // Just incase only images are sent.

  if (isThread) {
    const topGgLinkRegex = /https:\/\/top\.gg(?:\/[a-z]{2}(?:-[A-Z]{2})?)?\/bot\/(\d{1,32})/m;
    
    if (requestAuthorId === msg.author.id) return;
    const suggestingUserId = msg.author.id

    const matches = msg.content.match(topGgLinkRegex);

    if (!matches) return;
    if (matches || matches.length > 1) {
      const botId = matches[1];

      const botData = await topggApi.getBot(botId).catch(_ => null); // Fetch bot from top.gg

      if (!botData) return;

      const row = new ActionRowBuilder();

      const acceptButton = new ButtonBuilder()
        .setCustomId(`approve-${botId}-${originalMessageId}-${suggestingUserId}`)
        .setStyle(ButtonStyle.Success)
        .setLabel('Accept');

      const declineButton = new ButtonBuilder()
        .setCustomId(`decline-${botId}-${originalMessageId}-${suggestingUserId}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Decline');

      const components = [acceptButton, declineButton];
      row.addComponents(components);


      const embed = new EmbedBuilder()
        .setColor(embedColour) // Red border
        .setAuthor({
          name: botData.username,
          iconURL: botData?.avatar || null
        })
        .setDescription(botData.shortdesc + `\n### [**View this bot on top.gg**](<${matches[0]}>)` || "")
        .addFields({ name: "Server Count", value: `${botData.server_count.toLocaleString()}`, inline: true })
        .addFields({ name: "Monthly Votes", value: `${botData.monthlyPoints.toLocaleString()}`, inline: true })
        .addFields({ name: "Total Votes", value: `${botData.points.toLocaleString()}`, inline: true })
        .addFields({ name: "Tags", value: botData.tags.splice(0, 3).join(', '), inline: false })
        .setTimestamp();

      msg.reply({ content: `<@${requestAuthorId}> a new suggestion has come in:`, embeds: [embed], components: [row] });
    } else return;
  } else {
    // const { threads } = await msg.channel.threads?.fetch() 
    // const userHasThread = threads.find(t => t.name.startsWith(msg.author.username))
    // if (userHasThread) return;

    await database.request.create({
      data: {
        messageId: originalMessageId,
        request: msg.content,
        userId: msg.author.id
      }
    }).catch(e => {
      console.log(e)
    });

    const thread = await msg.startThread({ name: msg.author.username + " - Bot Suggestions" });
    await thread.send({
      embeds: [
        {
          color: embedColour,
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

client.on('interactionCreate', async (interaction) => {
  const [
    actionType,
    suggestedBotId,
    originalMessageId,
    suggestingUserId
  ] = interaction.customId.split('-');

  const message = interaction.channel.isThread() ? await interaction.channel.fetchStarterMessage() : null

  if (message) {
    await database.request.create({
      data: {
        messageId: message.id,
        request: message.content,
        userId: message.author.id
      }
    }).catch(e => {
      console.log(e)
    });
  }

  const request = await database.request.findFirst({
    where: {
      messageId: message.content.id || originalMessageId
    }
  })

  if (!request) {
    return interaction.reply({
      content: "Due to an update this interaction is now invalid.",
      ephemeral: true
    })
  }

  if (request.userId !== interaction.user.id) {
    return interaction.reply({
      content: "You can't close a request that isn't yours.",
      ephemeral: true
    });
  }

  switch (actionType) {
    case "approve": {

      await database.request.update({
        data: {
          fulfilledBy: suggestingUserId,
          requestFulfilledWith: suggestedBotId
        },
        where: {
          messageId: originalMessageId
        }
      }).catch(e => {
        console.log(e)
      });

      const botData = await topggApi.getBot(suggestedBotId).catch(_ => null); // Fetch bot from top.gg

      if (!botData) return interaction.reply({
        content: "Fetching bot data failed. Try again",
        ephemeral: true
      });

      const embed = new EmbedBuilder()
        .setColor(embedColour) // Red border
        .setAuthor({
          name: botData.username,
          iconURL: botData.avatar
        })
        .setDescription(botData.shortdesc + `\n### [**View this bot on top.gg**](<https://top.gg/bot/${suggestedBotId}>)` || "")
        .addFields({ name: "Server Count", value: `${botData.server_count.toLocaleString()}`, inline: true })
        .addFields({ name: "Monthly Votes", value: `${botData.monthlyPoints.toLocaleString()}`, inline: true })
        .addFields({ name: "Total Votes", value: `${botData.points.toLocaleString()}`, inline: true })
        .addFields({ name: "Tags", value: botData.tags.splice(0, 3).join(', '), inline: false })
        .setTimestamp();

      await interaction.channel.send({
        content: `**<@${request.userId}>'s request has been fulfilled successfully by <@${suggestingUserId}>**`,
        embeds: [embed]
      });

      (await interaction.guild.members.fetch(suggestingUserId)).roles.add(botDetectiveRoleId);

      await interaction.message.edit({ components: [] });

      await interaction.channel.setLocked(true, "Request fullfilled");
    } break;
    case "decline": {
      await interaction.message.edit({ content: "This suggestion was declined", components: [] });
    } break;
    default: {
      await interaction.reply("Sorry either this interaction has expired or you do not have access to it.");
    }
  }
});

client.on('ready', () => {
  console.log('Detective is detectivating.');
});

client.login(discordToken);