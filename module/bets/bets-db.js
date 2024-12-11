const { write } = require('../../utilities/db-connection');
const SQL_INSERT_BETS = 'INSERT INTO bets (bet_id, lobby_id, user_id, operator_id, bet_amount, bet_data, room_id) VALUES(?,?,?,?,?,?,?)';
const SQL_INSERT_STATS = 'INSERT INTO round_stats (lobby_id, winning_number, total_win_count, total_bet_amount, total_cashout_amount) VALUES(?,?,?,?,?)';

const addSettleBet = async (settlements) => {
    try {
        console.log(JSON.stringify(settlements), "okkk");
        const finalData = [];
        for (let settlement of settlements) {
            const { bet_id, lobby_id, totalBetAmount, userBets, roomId, totalMaxMult, winAmount } = settlement;
            const [initial, user_id, operator_id] = bet_id.split(':');
            finalData.push([bet_id, lobby_id, decodeURIComponent(user_id), operator_id, totalBetAmount, userBets, roomId, totalMaxMult, winAmount]);
        }
        const placeholders = finalData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const SQL_SETTLEMENT = ` INSERT INTO settlement  (bet_id, lobby_id, user_id, operator_id, bet_amount, bet_data, room_id, total_max_mult, win_amount)  VALUES ${placeholders}`;
        const flattenedData = finalData.flat();
        await write(SQL_SETTLEMENT, flattenedData);
        console.info("Settlement Data Inserted Successfully")
    } catch (err) {
        console.error(err);
    }
}


const insertBets = async (betData) => {
    try {
        const { userBets, bet_id, roomId, totalBetAmount, lobby_id} = betData;
        const [initial, user_id, operator_id] = bet_id.split(':');
        await write(SQL_INSERT_BETS, [bet_id, lobby_id, decodeURIComponent(user_id), operator_id, totalBetAmount, userBets, roomId]);
        console.info(`Bet placed successfully for user`, user_id);
    } catch (err) {
        console.error(err);
    }
}

const insertStatsData = async(statsData) => {
    try{
        const { lobby_id, winning_number, total_win_count, total_bet_amount, total_cashout_amount} = statsData;
        await write(SQL_INSERT_STATS, [lobby_id, winning_number, total_win_count, total_bet_amount, total_cashout_amount]);
        console.info(`Stats inserted successfully`);
    } catch (err) {
        console.error(err);
    }
}


module.exports = { addSettleBet, insertBets, insertStatsData};