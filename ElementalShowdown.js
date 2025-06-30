// ElementalShowdown.js - Class definition for the Elemental Showdown game

const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');

class ElementalShowdown {
    constructor(interaction, player1, player2, client) {
        this.interaction = interaction;
        this.player1 = player1;
        this.player2 = player2;
        this.client = client; // Client instance to manage the global games collection
        this.scores = { [player1.id]: 0, [player2.id]: 0 };
        this.moves = { [player1.id]: null, [player2.id]: null };
        this.round = 1;
        this.gameMessage = null;
        this.dendroCore = false; // To track if a Dendro Core is active
        this.dendroPlayer = null; // To track who created the Dendro Core
    }

    // Method to start the game
    async startGame() {
        const embed = this.createGameEmbed();
        const components = this.createActionRows();

        this.gameMessage = await this.interaction.channel.send({
            embeds: [embed],
            components: components
        });
    }

    // Method to handle a player's move
    async handleMove(interaction) {
        const player = interaction.user;
        const element = interaction.values[0];

        // Ensure only the game players can interact
        if (player.id !== this.player1.id && player.id !== this.player2.id) {
            return interaction.reply({ content: "You are not part of this game!", ephemeral: true });
        }

        // Ensure the player hasn't already made a move this round
        if (this.moves[player.id]) {
            return interaction.reply({ content: "You have already made your move for this round!", ephemeral: true });
        }

        this.moves[player.id] = element;
        await interaction.reply({ content: `You have chosen ${element}. Waiting for the other player.`, ephemeral: true });

        // Check if both players have made their moves
        if (this.moves[this.player1.id] && this.moves[this.player2.id]) {
            this.processRound();
        }
    }

    // Method to process the round and determine the winner
    processRound() {
        const move1 = this.moves[this.player1.id];
        const move2 = this.moves[this.player2.id];
        let roundResult = "";
        let winner = null;
        let bonusPoints = 0;

        if (this.dendroCore) {
            let dendroTriggerPlayer = (move1 === 'Electro' || move1 === 'Pyro') ? this.player1 : null;
            let otherPlayer = (move2 === 'Electro' || move2 === 'Pyro') ? this.player2 : null;

            if (move1 === move2) {
                dendroTriggerPlayer = null;
                otherPlayer = null;
            }

            if (dendroTriggerPlayer && dendroTriggerPlayer.id === this.dendroPlayer.id) {
                winner = dendroTriggerPlayer;
                bonusPoints = 2;
                roundResult = move1 === 'Electro' ? "Hyperbloom!" : "Burgeon!";
            } else if (otherPlayer && otherPlayer.id !== this.dendroPlayer.id) {
                winner = otherPlayer;
                bonusPoints = 1;
                roundResult = "Opponent triggered the core!";
            } else {
                roundResult = "The Dendro Core was not triggered and fades away.";
            }
            this.dendroCore = false;
            this.dendroPlayer = null;
        } else {

            // --- Core Elemental Cycle ---
            if (move1 === 'Pyro' && move2 === 'Cryo') winner = this.player1;
            else if (move1 === 'Cryo' && move2 === 'Pyro') winner = this.player2;
            else if (move1 === 'Cryo' && move2 === 'Hydro') winner = this.player1;
            else if (move1 === 'Hydro' && move2 === 'Cryo') winner = this.player2;
            else if (move1 === 'Hydro' && move2 === 'Pyro') winner = this.player1;
            else if (move1 === 'Pyro' && move2 === 'Hydro') winner = this.player2;

            // --- Electro Reactions ---
            else if ((move1 === 'Electro' && move2 === 'Hydro') || (move1 === 'Hydro' && move2 === 'Electro')) {
                roundResult = "Electro-Charged! It's a tie!";
            } else if (move1 === 'Electro' && move2 === 'Pyro') { winner = this.player1; bonusPoints = 1; roundResult = "Overloaded!"; }
            else if (move1 === 'Pyro' && move2 === 'Electro') { winner = this.player2; bonusPoints = 1; roundResult = "Overloaded!"; }
            else if (move1 === 'Electro' && move2 === 'Cryo') { winner = this.player1; bonusPoints = 1; roundResult = "Superconduct!"; }
            else if (move1 === 'Cryo' && move2 === 'Electro') { winner = this.player2; bonusPoints = 1; roundResult = "Superconduct!"; }

            // --- Anemo Reactions ---
                //TODO maybe add actual interactions for anemo and geo
            else if (move1 === 'Anemo' || move2 === 'Anemo') {
                roundResult = "Swirl! The round is a tie.";
            }

            // --- Geo Reactions ---
            else if (move1 === 'Geo' || move2 === 'Geo') {
                roundResult = "Crystallize! The round is a push.";
            }
            // --- Dendro Reactions ---
            
            // Check for non-core Dendro reactions
            else if ((move1 === 'Dendro' && move2 === 'Electro') || (move1 === 'Electro' && move2 === 'Dendro')) {
                roundResult = "Quicken! The round is a tie.";
            }
            else if ((move1 === 'Dendro' && move2 === 'Cryo') || (move1 === 'Cryo' && move2 === 'Dendro')) {
                roundResult = "No reaction! The round is a tie.";
            }
            // Check for reactions that create a Dendro Core or cause Burning
            else if (move1 === 'Dendro' && move2 === 'Pyro') { winner = this.player2; roundResult = "Burning!"; }
            else if (move1 === 'Pyro' && move2 === 'Dendro') { winner = this.player1; roundResult = "Burning!"; }
            else if ((move1 === 'Dendro' && move2 === 'Hydro')) {
                this.dendroCore = true;
                this.dendroPlayer = this.player1;
                roundResult = "Bloom! A Dendro Core was created.";
            } else if ((move1 === 'Hydro' && move2 === 'Dendro')) {
                this.dendroCore = true;
                this.dendroPlayer = this.player2;
                roundResult = "Bloom! A Dendro Core was created.";
            }

            // --- Same Element ---
            else if (move1 === move2) {
                roundResult = "Both players chose the same element! It's a tie.";
            }
        }

        if (winner) {
            this.scores[winner.id] += 1 + bonusPoints;
            roundResult += ` ${winner.username} wins the round!`;
        }

        if (this.scores[this.player1.id] >= 5 || this.scores[this.player2.id] >= 5) {
            this.endGame(roundResult);
        } else {
            this.nextRound(roundResult);
        }
    }

    // Method to start the next round
    nextRound(roundResult) {
        this.round++;
        this.moves = { [this.player1.id]: null, [this.player2.id]: null };
        const embed = this.createGameEmbed(roundResult);
        const components = this.createActionRows();

        this.gameMessage.edit({
            embeds: [embed],
            components: components
        });
    }

    // Method to end the game
    endGame(roundResult) {
        const finalWinner = this.scores[this.player1.id] >= 5 ? this.player1 : this.player2;
        const embed = new EmbedBuilder()
            .setTitle('Elemental Showdown - Game Over!')
            .setDescription(`${roundResult}\n\n**${finalWinner.username} is the ultimate victor!**`)
            .setColor('Gold')
            .addFields(
                { name: `${this.player1.username}'s Score`, value: `${this.scores[this.player1.id]}`, inline: true },
                { name: `${this.player2.username}'s Score`, value: `${this.scores[this.player2.id]}`, inline: true }
            );

        this.gameMessage.edit({ embeds: [embed], components: [] });
        this.client.games.delete(this.interaction.channel.id);
    }

    // Helper method to create the game embed
    createGameEmbed(roundResult = "") {
        let description = `A battle between ${this.player1.username} and ${this.player2.username}.\n\n${roundResult}`;
        if (this.dendroCore) {
            description += `\n\nA Dendro Core is on the field, created by ${this.dendroPlayer.username}!`;
        }
        return new EmbedBuilder()
            .setTitle('Elemental Showdown!')
            .setDescription(description)
            .setColor('Aqua')
            .addFields(
                { name: 'Round', value: `${this.round}`, inline: true },
                { name: `${this.player1.username}'s Score`, value: `${this.scores[this.player1.id]}`, inline: true },
                { name: `${this.player2.username}'s Score`, value: `${this.scores[this.player2.id]}`, inline: true }
            )
            .setFooter({ text: 'Choose your element below.' });
    }

    // Helper method to create action rows with dropdowns
    createActionRows() {
        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('element_select')
                    .setPlaceholder('Choose your element')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Pyro')
                            .setValue('Pyro')
                            .setEmoji({name: '🔥'}),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Hydro')
                            .setValue('Hydro')
                            .setEmoji({name: '💧'}),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Cryo')
                            .setValue('Cryo')
                            .setEmoji({name: '❄️'}),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Electro')
                            .setValue('Electro')
                            .setEmoji({name: '⚡'}),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Anemo')
                            .setValue('Anemo')
                            .setEmoji({name: '💨'}),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Geo')
                            .setValue('Geo')
                            .setEmoji({name: '🪨'}),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Dendro')
                            .setValue('Dendro')
                            .setEmoji({name: '🌱'})
                    )
            );
        return [row];
    }
}

module.exports = ElementalShowdown;