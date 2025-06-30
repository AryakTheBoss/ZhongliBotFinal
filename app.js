// index.js

// Require necessary discord.js classes
const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const ElementalShowdown = require('./ElementalShowdown.js');

// Require the characterai.io library
const { CharacterAI } = require("node_characterai");

// Get configuration from config.json
const { token, characterId, characterAiToken } = require('./config.json');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions
    ]
});

client.games = new Collection();

// Initialize the CharacterAI client
var characterAI = new CharacterAI();

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    if (!characterAiToken) {
        console.error("Character.ai token is missing from config.json. Please add it to use the bot.");
        return; // Stop the bot if the token is missing
    }
    client.user.setPresence({
        activities: [{ name: '/cai <prompt>', type: ActivityType.Playing }],
        status: 'online',
    });
    try {
        // Authenticate as a guest
        await characterAI.authenticate(characterAiToken);
        console.log('Successfully authenticated with Character.ai');
    } catch (error) {
        console.error('Failed to authenticate with Character.ai:', error);
    }


    const commands = [
        new SlashCommandBuilder()
            .setName('cai')
            .setDescription('Talk to the Character.ai character')
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('The message to send to the character')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('reset')
            .setDescription('Resets the conversation history with the character.'),
        new SlashCommandBuilder()
            .setName('elemental-showdown')
            .setDescription('Starts a game of Elemental Showdown.')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('challenge')
                    .setDescription('Challenge a specific player.')
                    .addUserOption(option => option.setName('opponent').setDescription('The player to challenge').setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('open')
                    .setDescription('Create an open game for anyone to join.'))
    ].map(command => command.toJSON());

    const rest = new REST({ version: '9' }).setToken(token);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {   

    const { commandName } = interaction;
    if (interaction.isCommand()) {

        if (interaction.commandName === 'elemental-showdown') {
            if (client.games.has(interaction.channel.id)) {
                return interaction.reply({ content: "A game is already in progress in this channel.", ephemeral: true });
            }

            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'challenge') {
                const opponent = interaction.options.getUser('opponent');
                if (opponent.bot) {
                    return interaction.reply({ content: "You can't challenge a bot!", ephemeral: true });
                }
                if (opponent.id === interaction.user.id) {
                    return interaction.reply({ content: "You can't challenge yourself!", ephemeral: true });
                }

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_challenge_${interaction.user.id}`)
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success)
                    );

                await interaction.reply({
                    content: `${opponent}, you have been challenged to Elemental Showdown by ${interaction.user}!`,
                    components: [row]
                });

            } else if (subcommand === 'open') {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`join_open_game_${interaction.user.id}`)
                            .setLabel('Join Game')
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.reply({
                    content: `${interaction.user} has started an open game of Elemental Showdown!`,
                    components: [row]
                });
            }
        }

        if (commandName === 'cai') {
            const message = interaction.options.getString('message');
            await interaction.deferReply(); // Defer reply to avoid timeout

            try {
                const character = await characterAI.fetchCharacter(characterId);
                const dm = await character.DM();
                const res = await dm.sendMessage(message);

                await interaction.editReply(res.content);
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'There was an error while communicating with Character.ai.', ephemeral: true });
            }
        }
        if (commandName === 'reset') {
            await interaction.deferReply();
            try {
                // Re-initialize and re-authenticate the client to start a fresh session
                characterAI = new CharacterAI();
                await characterAI.authenticate(characterAiToken);

                console.log('Chat history has been reset.');
                await interaction.editReply('Conversation history has been reset successfully!');
            } catch (error) {
                console.error('Failed to reset chat history:', error);
                await interaction.editReply({ content: 'There was an error while trying to reset the chat history.', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        const customIdParts = interaction.customId.split('_');
        const action = customIdParts[0];
        const challengerId = customIdParts[customIdParts.length - 1];

        if (action === 'accept') {
            // Check if the user who clicked is the one who was challenged.
            // The original message is like: `<@OPPONENT_ID>, you have been challenged...`
            if (!interaction.message.content.startsWith(`<@${interaction.user.id}>`)) {
                return interaction.reply({ content: "You were not the one challenged!", ephemeral: true });
            }
        }

        if (action === 'accept' || action === 'join') {
            const challenger = await client.users.fetch(challengerId);
            const opponent = interaction.user;

            if (opponent.id === challenger.id) {
                return interaction.reply({ content: "You can't join your own game!", ephemeral: true });
            }

            // Create a new game instance, passing the client to it
            const game = new ElementalShowdown(interaction, challenger, opponent, client);
            client.games.set(interaction.channel.id, game);

            await interaction.update({ content: `Game started between ${challenger.username} and ${opponent.username}!`, components: [] });
            game.startGame();
        }
    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'element_select') {
            const game = client.games.get(interaction.channel.id);
            if (game) {
                game.handleMove(interaction);
            }
        }
    }
});


// Login to Discord with your client's token
client.login(token);
