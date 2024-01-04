/** @format */

const { Events } = require('discord.js');
const {
	handleButtonInteraction,
} = require('../handlers/interaction/buttonInteraction.js');
const {
	handleModalInteraction,
} = require('../handlers/interaction/modalInteraction.js');
const pool = require('../handlers/data/pool.js');

async function isUserBlacklisted(userId) {
	const [rows] = await pool.execute(
		'SELECT * FROM blacklisted_users WHERE user_id = ?',
		[userId]
	);
	return rows.length > 0;
}

async function isServerBlacklisted(serverId) {
	const [rows] = await pool.execute(
		'SELECT * FROM blacklisted_servers WHERE server_id = ?',
		[serverId]
	);
	return rows.length > 0;
}

async function handleErrorInteraction(interaction) {
	let errorMessage =
		'# Something unexpected happened!\n\n**There was an error while executing this command!\nPlease try again later. If the issue persists, please [contact](https://chesscord.com/discord) the bot owner.\n\nSorry for the inconvenience.\n\n~Koyshira <3 (Developer)**';

	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: errorMessage, ephemeral: true });
		} else {
			await interaction.reply({ content: errorMessage, ephemeral: true });
		}
	} catch (error) {
		console.error('Error while handling interaction error:', error);
	}
}

async function handleBlacklist(interaction) {
	try {
		const isUserBlacklistedValue = await isUserBlacklisted(interaction.user.id);
		const isServerBlacklistedValue = interaction.guildId
			? await isServerBlacklisted(interaction.guildId)
			: false;

		if (isServerBlacklistedValue) {
			await interaction.reply(
				'Members of this guild are unable to access commands.'
			);
			return;
		}

		if (isUserBlacklistedValue) {
			await interaction.reply(
				'You are blacklisted and unable to use commands.'
			);
			return;
		}
	} catch (error) {
		console.error('Error occurred while checking blacklist:', error);
		handleErrorInteraction(interaction);
	}
}

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		handleBlacklist(interaction);
		try {
			if (interaction.isCommand()) {
				const command = interaction.client.commands.get(
					interaction.commandName
				);
				if (!command) {
					console.error(
						`No command matching ${interaction.commandName} was found.`
					);
					return;
				}

				await command.execute(interaction);
			} else if (interaction.isButton()) {
				await handleButtonInteraction(interaction);
			} else if (interaction.isModalSubmit()) {
				await handleModalInteraction(interaction);
			}
		} catch (error) {
			console.error(
				`Error occurred during ${interaction.type} processing:`,
				error
			);
			handleErrorInteraction(interaction);
		}
	},
};
