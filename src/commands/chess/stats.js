/** @format */

const axios = require('axios');

const {
	ERROR_Color,
	SUCCESS_Color,
	INFO_Color,
} = require('../../data/config.json');
const pool = require('../../handlers/data/pool.js');

module.exports = {
	data: {
		name: 'stats',
		description: 'Get your lichess stats',
	},

	async execute(interaction) {
		const [user] = await pool.query(
			'SELECT lichess_username FROM linked_users WHERE id = ? LIMIT 1',
			[interaction.user.id]
		);

		if (user.length === 0) {
			const errorEmbed = {
				color: ERROR_Color,
				title: 'No linked account found',
				description: 'Link your lichess account with `/link`',
			};

			return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
		}

		const stats = await axios.get(
			`https://lichess.org/api/user/${user[0].lichess_username}`
		);

		const statsEmbed = {
			color: INFO_Color,
			title: `${stats.data.username}'s Stats`,
			fields: [
				{
					name: 'Rating',
					value: `\`${stats.data.perfs.correspondence.rating}\``,
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: true,
				},
				{
					name: 'Reliability Deviation',
					value: `\`${stats.data.perfs.correspondence.rd}\``,
					inline: true,
				},
				{
					name: 'Games Played',
					value: `\`${stats.data.count.all}\``,
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: true,
				},
				{
					name: 'In Progress',
					value: `\`${stats.data.count.playing}\``,
					inline: true,
				},
				{
					name: 'Wins',
					value: `\`${stats.data.count.win}\``,
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: true,
				},
				{
					name: 'Losses',
					value: `\`${stats.data.count.loss}\``,
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: false,
				},
				{
					name: `User Profile: https://lichess.org/@/${user[0].lichess_username}`,
					value: '',
					inline: false,
				},
			],
		};

		await interaction.reply({ embeds: [statsEmbed] });
	},
};
