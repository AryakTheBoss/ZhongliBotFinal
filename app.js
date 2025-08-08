// index.js

// Require necessary discord.js classes
const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const ElementalShowdown = require('./ElementalShowdown.js');
const LiyueCredits = require('./LiyueCredits.js');

// Require the characterai.io library
const { CharacterAI } = require("node_characterai");

// Get configuration from config.json
let {token, characterId, characterAiToken} = require('./config.json');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ]
});

client.games = new Collection();
const liyueCredits = new LiyueCredits();

// Initialize the CharacterAI client
var characterAI = new CharacterAI();
const gambleOptions = [{name: '20x - 0.1% winrate', value: '20x'}, {name: '15x - 0.2% winrate', value: '15x'}, {name: '10x - 0.4% winrate', value: '10x'}, {name: '5x - 0.8% winrate', value: '5x'}, {name: '2x - 1.6% winrate', value: '2x'}, {name: '1.5x - 3.2% winrate', value: '1.5x'}];

function formatTimeLeft(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function removeMDfromUsername(username) {
   return username.replaceAll('_','\\_').replaceAll('*', '\\*');
}

function getRandomInt(lower, upper) {
    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function getChance(percentage) {
    return Math.random() * 100 < percentage;
}

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    if(process.env.CAI_TOKEN){
        characterAiToken = process.env.CAI_TOKEN;
    }
    if(process.env.DISCORD_TOKEN){
        token = process.env.DISCORD_TOKEN;
    }
    //load the settings for liyue credits from the DB
    liyueCredits.refreshSettingsFromDB();

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
                    .setDescription('Create an open game for anyone to join.')),
        new SlashCommandBuilder()
            .setName('liyue-credit')
            .setDescription('Give or take someones liyue credit')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('remove liyue credits to a user')
                    .addUserOption(option => option.setName('user').setDescription('The user to discredit').setRequired(true))
                    .addIntegerOption(option => option.setName('amount').setDescription('The amount to discredit').setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('add liyue credits to a user')
                    .addUserOption(option => option.setName('user').setDescription('The user to credit').setRequired(true))
                    .addIntegerOption(option => option.setName('amount').setDescription('The amount to credit').setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('gamble')
                    .setDescription('gamble your own credits. max bet is full balance')
                    .addStringOption(option => option.setName('multiplier').setDescription('The multiplier if you win').setRequired(true).setChoices(...gambleOptions))
                    .addBooleanOption(option => option.setName('double-odds').setDescription('doubles the odds of winning but the multiplier also applies to your losses').setRequired(true))
                    .addIntegerOption(option => option.setName('wager').setDescription('The amount to wager').setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('check')
                    .setDescription('check liyue credits of a user')
                    .addUserOption(option => option.setName('user').setDescription('The user to check').setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('leaderboard')
                    .setDescription('check liyue credits board'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('settings')
                    .setDescription('change settings for liyue credits')
                    .addIntegerOption(option => option.setName('cooldown').setDescription('The cooldown for remove').setRequired(false))
                    .addIntegerOption(option => option.setName('amountlimit').setDescription('The amount limit for adding removing').setRequired(false))
                    .addBooleanOption(option => option.setName('negativecreditsallowed').setDescription('allow negative values').setRequired(false)))

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

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    //TODO add these words as database tables and add command to add and remove them at will
    const forbiddenWords = ['league of legends', 'league', 'favonius', 'fav', 'energy recharge', 'er'];
    const likedWords = ['coffie_wink', 'kafka', 'thigh', 'liyue', 'teriderp', 'yelan'];
    const messageContent = message.content.toLowerCase();
    const matchedWordMinus = forbiddenWords.find(word => messageContent.toLowerCase().search('\\b'+word+'\\b') !== -1);
    const matchedWordPlus = likedWords.find(word => messageContent.toLowerCase().search('\\b'+word+'\\b') !== -1);

    if (matchedWordMinus) {
        const userId = message.author.id;
        const guildId = message.guild.id;
        const amount = getRandomInt(5000, 50000);

        liyueCredits.removeCredits(userId, amount, guildId, true);
        if(message.guild.id === '961701527096021042'){ //These people are so unfun :(
            if(message.channel.id === '1018936077723127948'){
                await message.reply(`You mentioned ${matchedWordMinus}! You lose ${amount} Liyue credits.`);
            }
            return;
        }
        await message.reply(`You mentioned ${matchedWordMinus}! You lose ${amount} Liyue credits.`);
    } else if (matchedWordPlus && liyueCredits.canAddCreditsGoodWord(message.author.id, message.guild.id).canRemove) {
        const userId = message.author.id;
        const guildId = message.guild.id;
        const amount = getRandomInt(100, 1500);

        liyueCredits.addCredits(userId, amount, guildId, true);
        if(message.guild.id === '961701527096021042'){ //These people are so unfun :(
            if(message.channel.id === '1018936077723127948' && matchedWordPlus !== 'thigh'){
                await message.reply(`You mentioned ${matchedWordPlus}! You get ${amount} Liyue credits.`);
            }
            return;
        }
        await message.reply(`You mentioned ${matchedWordPlus}! You get ${amount} Liyue credits.`);
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

        if(commandName === 'liyue-credit'){
            await interaction.deferReply();
            const subcommand = interaction.options.getSubcommand();
            const settings = liyueCredits.getCachedSettings();
            if(subcommand === 'remove'){
                const user = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');
                if(user.bot){
                    return interaction.editReply({ content: "You can't discredit a bot!", ephemeral: true });
                }
                if(user.id === interaction.user.id){
                    return interaction.editReply({ content: "You can't discredit yourself!", ephemeral: true });
                }
                if(amount > settings.amountLimit && settings.amountLimit !== -1){ //-1 indicates no limit
                    return interaction.editReply({ content: `You can't take more than ${settings.amountLimit} liyue credits at a time!`, ephemeral: true });
                }
                const cooldownStatus = liyueCredits.canRemoveCredits(user.id, interaction.guild.id);
                if (!cooldownStatus.canRemove) {
                    const timeLeft = formatTimeLeft(cooldownStatus.timeLeft);
                    return interaction.editReply({ content: `You cannot take credits from ${user.username} yet. Please wait another ${timeLeft}.`, ephemeral: true });
                }
                if(amount < 0 && !settings.negativeCredits){
                    return interaction.editReply({ content: "You can't remove negative numbers, use add command instead!", ephemeral: true });
                }
                liyueCredits.removeCredits(user.id, amount, interaction.guild.id, false);
                return interaction.editReply({ content: `${interaction.user} has taken ${amount} liyue credits from ${user}!! Get mogged.`, ephemeral: true });

            } else if(subcommand === 'add'){
                const user = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');
                if(user.bot){
                    return interaction.editReply({ content: "You can't credit a bot!", ephemeral: true });
                }
                if(user.id === interaction.user.id){
                    return interaction.editReply({ content: "You can't credit yourself!", ephemeral: true });
                }
                if(amount > settings.amountLimit && settings.amountLimit !== -1){
                    return interaction.editReply({ content: `You can't add more than ${settings.amountLimit} liyue credits at a time!`, ephemeral: true });
                }
                const cooldownStatus = liyueCredits.canAddCredits(user.id, interaction.guild.id);
                if(!cooldownStatus.canRemove){
                    const timeLeft = formatTimeLeft(cooldownStatus.timeLeft);
                    return interaction.editReply({ content: `You cannot add credits to ${user.username} yet. Please wait another ${timeLeft}.`, ephemeral: true });
                }
                if(amount < 0 && !settings.negativeCredits){
                    return interaction.editReply({ content: "You can't add negative numbers, use remove command instead!", ephemeral: true });
                }
                liyueCredits.addCredits(user.id, amount, interaction.guild.id, false);
                return interaction.editReply({ content: `${interaction.user} has given ${user} ${amount} liyue credits!! Well done Traveller.`, ephemeral: true });

            } else if (subcommand === 'gamble') {
                const user = interaction.user;
                const balance = liyueCredits.checkCredits(user.id, interaction.guild.id);
                const wager = interaction.options.getInteger('wager');
                const multiplier = interaction.options.getString('multiplier');
                const doubleOdds = interaction.options.getBoolean('double-odds');
                if(balance < 1){
                    return interaction.editReply({ content: "In terms of mora, you have no mora lol", ephemeral: true });
                }
                if(wager > balance){
                    return interaction.editReply({ content: "Your wager cannot be higher than your credits balance", ephemeral: true });
                }
                if(wager <= 0){
                    return interaction.editReply({ content: "You cannot wager negative or 0", ephemeral: true });
                }
                const multiplierNumber = parseFloat(multiplier.replace("x", ""));
                const odds = Math.pow(2, gambleOptions.findIndex(str => str.value === multiplier)) * 0.3;
                liyueCredits.removeCredits(user.id, wager, interaction.guild.id, false); //Take the wager

                const potentialwinnings = wager * multiplierNumber;
                //console.log("Gambling for: "+potentialwinnings+" Odds: "+(doubleOdds ? odds*2 : odds)+"% Double Odds: "+doubleOdds+" Multiplier: "+multiplierNumber+"");
                if(doubleOdds){
                    if(getChance(odds*2)){
                        liyueCredits.addCredits(user.id, potentialwinnings, interaction.guild.id, false);
                        return interaction.editReply({ content: `You won the double-odds roll!! and got ${potentialwinnings} liyue credits.`, ephemeral: true });
                    }
                    liyueCredits.removeCredits(user.id, (potentialwinnings) - wager, interaction.guild.id, false);
                    return interaction.editReply({ content: `You lost the double-odds roll and lost ${potentialwinnings} liyue credits.`, ephemeral: true });

                } else {
                    if(getChance(odds)){
                        liyueCredits.addCredits(user.id, potentialwinnings, interaction.guild.id, false);
                        return interaction.editReply({ content: `You won the roll!! and got ${potentialwinnings} liyue credits.`, ephemeral: true });
                    }
                    return interaction.editReply({ content: `You lost the roll and lost ${wager} liyue credits.`, ephemeral: true });
                }
            } else if(subcommand === 'check'){
                const user = interaction.options.getUser('user') || interaction.user;
                const credits = liyueCredits.checkCredits(user.id, interaction.guild.id);
                return interaction.editReply({ content: `${user.username} has ${credits} Liyue credits.`, ephemeral: true });
            } else if(subcommand === 'leaderboard'){
                const board = liyueCredits.getLeaderboard(interaction.guild.id);
                if(board.size === 0){
                    return interaction.editReply({ content: "No records found in Database.", ephemeral: true });
                }
                let stringBoard = "--- Leaderboard ---\n";
                let rank = 1;
                // Iterate through the sorted map of [userId, score]
                for (const [userId, amount] of board.entries()) {
                    try {
                        // Asynchronously fetch the user object from the ID
                        const user = await client.users.fetch(userId);
                        const username = removeMDfromUsername(user.username);
                        stringBoard += `${rank}: ${username} \\~\\~ ${amount}\n`;
                    } catch (error) {
                        console.error(`Could not find user with ID: ${userId}`);
                    }
                    rank++;
                }
                return interaction.editReply({ content: stringBoard, ephemeral: true });
            } else if(subcommand === 'settings'){
                if(interaction.user.id !== '144828640146882560'){
                    return interaction.editReply({ content: "You don't have permission to edit settings", ephemeral: true });
                }
                const cooldown = interaction.options.getInteger('cooldown');
                const amountLimit = interaction.options.getInteger('amountlimit');
                const negativeCreditsAllowed = interaction.options.getBoolean('negativecreditsallowed');
                liyueCredits.changeSettings(cooldown, amountLimit, negativeCreditsAllowed);
                return interaction.editReply({ content: "Settings changed.", ephemeral: true });
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
