const { Events } = require('discord.js');
const { handleButtonInteraction } = require('../commands/chess/challenge.js');
const fs = require('fs');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Read the blacklist data from the file
        const blacklistData = JSON.parse(fs.readFileSync('data/blacklist.json', 'utf-8'));

        // Extract user and server IDs from the loaded data
        const { user_ids, server_ids } = blacklistData;

        if (interaction.guildId && server_ids.includes(interaction.guildId)) {
            await interaction.reply("Members of this guild are unable to access commands.");
            return;
        }

        if (interaction.user.id && user_ids.includes(interaction.user.id)) {
            await interaction.reply("You are blacklisted and unable to use commands.");
            return;
        }

        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await handleErrorInteraction(interaction);
            }
        } else if (interaction.isButton()) {
            const button = interaction.customId;
            if (!button) {
                console.error(`No button matching ${interaction.customId} was found.`);
                return;
            }
            try {
                await handleButtonInteraction(interaction);
            } catch (error) {
                console.error(error);
                await handleErrorInteraction(interaction);
            }
        }
    },
};

async function handleErrorInteraction(interaction) {
    const errorMessage = 'There was an error while executing this command!';
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
    }
}
