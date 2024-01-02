/** @format */

const pool = require('./data/pool.js');

const ELO_K_FACTOR = 32;

async function getUserStats(playerId, connection) {
	const [row] = await connection.query(
		'SELECT * FROM leaderboard WHERE user_id = ?',
		[playerId]
	);

	if (!row.length) {
		await connection.query(
			'INSERT INTO leaderboard (user_id, total_games, wins, losses, draws, elo) VALUES (?, 0, 0, 0, 0, 900)',
			[playerId]
		);
	}

	return row.length
		? row[0]
		: {
				user_id: playerId,
				total_games: 0,
				wins: 0,
				losses: 0,
				draws: 0,
				elo: 900,
		  };
}

function calculateExpected(a, b) {
	if (isNaN(a) || isNaN(b)) {
		throw new Error('Invalid Elo ratings for calculation.');
	}
	// Adjust the formula as needed
	return 1 / (1 + Math.exp(-(a - b) / ELO_K_FACTOR)); // Using the exponential function as an alternative
}

async function rollbackTransaction(connection) {
	if (connection) {
		await connection.rollback();
	}
}

module.exports = {
	calculateElo: async function (whiteId, blackId, result, winner = null) {
		// Validate input parameters
		if (!['end', 'end-draw', 'end-resign'].includes(result)) {
			throw new Error('Invalid result. Use "end", "end-draw" or "end-resign".');
		}

		if (winner && winner !== whiteId && winner !== blackId) {
			throw new Error('Invalid winner. Must be whiteId or blackId.');
		}

		const connection = await pool.getConnection();

		try {
			const whitePlayer = await getUserStats(whiteId, connection);
			const blackPlayer = await getUserStats(blackId, connection);

			const winnerPlayer = winner === whiteId ? whitePlayer : blackPlayer;
			const loserPlayer = winner === whiteId ? blackPlayer : whitePlayer;

			const winnerExpected = calculateExpected(
				parseInt(loserPlayer.elo),
				parseInt(winnerPlayer.elo)
			);
			const loserExpected = calculateExpected(
				parseInt(winnerPlayer.elo),
				parseInt(loserPlayer.elo)
			);

			let scoreMultiplier;

			switch (result) {
				case 'end':
					scoreMultiplier = 1;
					break;
				case 'end-draw':
					scoreMultiplier = 0.5;
					break;
				case 'end-resign':
					scoreMultiplier = 0.25;
					break;
			}

			const winnerNewElo =
				parseInt(winnerPlayer.elo) +
				ELO_K_FACTOR * (scoreMultiplier * winnerExpected);
			const loserNewElo =
				parseInt(loserPlayer.elo) - ELO_K_FACTOR * (1 - loserExpected);

			await connection.beginTransaction();

			const updateQuery =
				'UPDATE leaderboard SET elo = ?, total_games = ?, wins = ?, losses = ?, draws = ? WHERE user_id = ?';

			// Update elo and other fields for the winner
			await connection.query(updateQuery, [
				winnerNewElo,
				winnerPlayer.total_games + 1,
				winnerPlayer.wins +
					(result === 'end' ? 1 : 0 || result === 'end-resign' ? 1 : 0),
				winnerPlayer.losses +
					(result === 'end' ? 0 : 1 || result === 'end-resign' ? 0 : 1),
				winnerPlayer.draws + (result === 'end-draw' ? 1 : 0),
				winnerPlayer.user_id,
			]);

			// Update elo and other fields for the loser
			await connection.query(updateQuery, [
				loserNewElo,
				loserPlayer.total_games + 1,
				loserPlayer.wins +
					(result === 'end' ? 0 : 1 || result === 'end-resign' ? 0 : 1),
				loserPlayer.losses +
					(result === 'end' ? 1 : 0 || result === 'end-resign' ? 1 : 0),
				loserPlayer.draws + (result === 'end-draw' ? 1 : 0),
				loserPlayer.user_id,
			]);

			await connection.commit();

			return [
				winnerPlayer.elo,
				winnerNewElo,
				winnerPlayer.user_id,
				loserPlayer.elo,
				loserNewElo,
				loserPlayer.user_id,
			];
		} catch (error) {
			await rollbackTransaction(connection);
			throw new Error(`Error in calculateElo: ${error.message}`);
		} finally {
			if (connection) {
				connection.release();
			}
		}
	},
};
