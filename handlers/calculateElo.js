/** @format */

const pool = require('./data/pool.js');

const ELO_K_FACTOR = 32;

async function getEloRating(playerId, connection) {
	const [row] = await executeQuery(
		connection,
		'SELECT elo FROM leaderboard WHERE user_id = ?',
		[playerId]
	);
	return row.length ? row[0].elo : 900;
}

function calculateExpected(a, b) {
	return 1 / (1 + 10 ** ((a - b) / ELO_K_FACTOR));
}

async function executeQuery(connection, sql, values) {
	return connection.execute(sql, values);
}

async function rollbackTransaction(connection) {
	if (connection) {
		await connection.rollback();
	}
}

module.exports = {
	calculateElo: async function (whiteId, blackId, result, winner = null) {
		// Validate input parameters
		if (!['end', 'end-draw'].includes(result)) {
			throw new Error('Invalid result. Use "end" or "end-draw".');
		}

		if (winner && winner !== whiteId && winner !== blackId) {
			throw new Error('Invalid winner. Must be whiteId or blackId.');
		}

		const connection = await pool.getConnection();

		try {
			const whiteElo = await getEloRating(whiteId, connection);
			const blackElo = await getEloRating(blackId, connection);

			const winnerElo = winner === whiteId ? whiteElo : blackElo;
			const loserElo = winner === whiteId ? blackElo : whiteElo;

			const expected = calculateExpected(loserElo, winnerElo);

			const scoreMultiplier = result === 'end' ? 1 : 0.5;
			const whiteNewElo =
				whiteElo + ELO_K_FACTOR * (scoreMultiplier - expected);
			const blackNewElo =
				blackElo + ELO_K_FACTOR * (scoreMultiplier - expected);

			await connection.beginTransaction();

			const updateQuery = 'UPDATE leaderboard SET elo = ? WHERE user_id = ?';

			// Award points to the winner and deduct from the loser
			await executeQuery(connection, updateQuery, [whiteNewElo, whiteId]);
			await executeQuery(connection, updateQuery, [blackNewElo, blackId]);

			await connection.commit();

			return [whiteNewElo, blackNewElo];
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
