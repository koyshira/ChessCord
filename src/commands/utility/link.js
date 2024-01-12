/** @format */

const axios = require('axios');
const pool = require('../../handlers/data/pool.js');

const { ERROR_Color, SUCCESS_Color } = require('../../data/config.json');

module.exports = {
	data: {
		name: 'link',
		description: 'Link your account to your lichess account',
		options: [
			{
				name: 'username',
				description: 'Your lichess username',
				type: 3,
				required: true,
			},
		],
	},

	async execute(interaction) {
		const username = interaction.options.getString('username');
		const maxRetries = 3;

		const makeGetRequest = async (url) => {
			for (let retryCount = 1; retryCount <= maxRetries; retryCount++) {
				try {
					const response = await axios.get(url);
					return response.data;
				} catch (error) {
					console.log(`Retry ${retryCount} for GET request to ${url}`);
					if (retryCount === maxRetries) {
						throw error;
					}
				}
			}
		};

		const makePostRequest = async (url, data, config) => {
			for (let retryCount = 1; retryCount <= maxRetries; retryCount++) {
				try {
					const response = await axios.post(url, data, config);
					return response.data;
				} catch (error) {
					console.log(`Retry ${retryCount} for POST request to ${url}`);
					if (retryCount === maxRetries) {
						throw error;
					}
				}
			}
		};

		const connection = await pool.getConnection();

		const idData = await connection.query(
			'SELECT * FROM linked_users WHERE id = ?',
			[interaction.user.id]
		);

		const usernameData = await connection.query(
			'SELECT * FROM linked_users WHERE lichess_username = ?',
			[username]
		);

		connection.release();

		if (idData.length > 0) {
			const idAlreadyLinked = {
				color: ERROR_Color,
				description: `You have already linked your account to lichess.`,
			};

			return interaction.reply({
				embeds: [idAlreadyLinked],
				ephemeral: true,
			});
		} else if (usernameData.length > 0) {
			const userAlreadyLinkedEmbed = {
				color: ERROR_Color,
				description: `The lichess username you provided is already linked to another account.\nIf this is your account, please contact the developer.`,
			};

			return interaction.reply({
				embeds: [userAlreadyLinkedEmbed],
				ephemeral: true,
			});
		} else {
			try {
				const userData = await makeGetRequest(
					`https://lichess.org/api/user/${username}`
				);

				if (!userData) {
					const invalidUsernameEmbed = {
						color: ERROR_Color,
						description:
							'The username you provided is invalid.\nMake an account at https://lichess.org/',
					};

					return interaction.reply({
						embeds: [invalidUsernameEmbed],
						ephemeral: true,
					});
				}

				const note = await makePostRequest(
					`https://lichess.org/api/user/${username}/note`,
					{
						text: `Discord ID: ${interaction.user.id}`,
					},
					{
						headers: {
							Authorization: `Bearer ${process.env.LICHESS_API_TOKEN}`,
						},
					}
				);

				if (!note) {
					const invalidNoteEmbed = {
						color: ERROR_Color,
						description:
							'Something went wrong with adding the note. Please try again later.',
					};

					return interaction.reply({
						embeds: [invalidNoteEmbed],
						ephemeral: true,
					});
				}

				await pool.query(
					'INSERT INTO linked_users (id, lichess_username) VALUES (?, ?)',
					[interaction.user.id, username]
				);

				const linkEmbed = {
					color: SUCCESS_Color,
					description: `Your account has been linked to https://lichess.org/@/${username}.`,
				};

				interaction.reply({ embeds: [linkEmbed], ephemeral: true });
			} catch (error) {
				console.log(error);

				interaction.reply({
					content: 'Something went wrong. Please try again later.',
					ephemeral: true,
				});
			}
		}
	},
};
