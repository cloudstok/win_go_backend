const { prepareDataForWebhook, postDataToSourceForBet, getHalls } = require('../../utilities/common-function');
const { addSettleBet, insertBets, insertStatsData } = require('./bets-db');
const { appConfig } = require('../../utilities/app-config');
const { deleteCache, setCache, getCache } = require('../../utilities/redis-connection');
const { logEventAndEmitResponse, getPayoutMultiplier, getDetailsFromWinningNumber } = require('../../utilities/helper-function');
const getLogger = require('../../utilities/logger');
const { sendToQueue } = require('../../utilities/amqp');
const logger = getLogger('Bets', 'jsonl');
const settlBetLogger = getLogger('Settlement', 'jsonl');
const failedBetsLogger = getLogger('userFailedBets', 'log');
const creditQueueLogger = getLogger('CreditQueue', 'jsonl');
const erroredLogger = getLogger('ErrorData', 'log');

let lobbies = {};
let lobbiesBets = {};

const setCurrentLobby = (roomId, data) => {
    lobbies[roomId] = data;
};

const getTimer = (roomId) => {
    let timer = 0;
    if(roomId == 101) timer = 25;
    if(roomId == 102) timer = 55;
    if(roomId == 103) timer = 175;
    if(roomId == 104) timer = 295;
    return timer;  
}

const placeBet = async (io, socket, betData) => {
    try {
        const playerDetails = await getCache(`PL:${socket.id}`);
        if (!playerDetails) return socket.emit('message', { eventName: 'betError', data: { message: 'Invalid Player Details', status: false } });
        const parsedPlayerDetails = JSON.parse(playerDetails);
        const { id, userId, operatorId, token, game_id, balance } = parsedPlayerDetails;
        const [lobbyId, roomId, betAmount, chip] = betData;
        const lobbyTimer = lobbyId.split('-')[0];
        const lobbyTime = Number(lobbyTimer.slice(8, lobbyTimer.length));
        const bet_id = `BT:${lobbyId}:${roomId}:${userId}:${operatorId}:${betAmount}:${chip}:${Date.now()}`;
        const betObj = { id, bet_id, token, socket_id: parsedPlayerDetails.socketId, game_id, betAmount, chip, roomId };
        const rooms = [101, 102, 103, 104];
        if (lobbies[roomId]?.lobbyId !== lobbyId || lobbies[roomId].status != 0) return logEventAndEmitResponse(socket, betObj, 'Invalid Lobby Id Passed', 'bet');
        const maxTimer = getTimer(Number(roomId));
        if ((Date.now() - lobbyTime) / 1000 > maxTimer) return logEventAndEmitResponse(socket, betObj, 'Lobby timed out', 'bet');
        if (!rooms.includes(Number(roomId))) return logEventAndEmitResponse(socket, betObj, 'Invalid Room Id Passed', 'bet');
        if (betAmount < Number(appConfig.minBetAmount) || betAmount > Number(appConfig.maxBetAmount)) return logEventAndEmitResponse(socket, betObj, 'Invalid Bet Amount', 'bet');

        if (Number(betAmount) > Number(balance)) {
            return logEventAndEmitResponse(socket, betObj, 'Insufficient Balance', 'bet');
        }

        const webhookData = await prepareDataForWebhook({ lobby_id: lobbyId, betAmount, game_id, bet_id, user_id: userId }, "DEBIT", socket);
        betObj.txn_id = webhookData.txn_id;

        try {
            await postDataToSourceForBet({ webhookData, token, socketId: socket.id });
        } catch (err) {
            failedBetsLogger.error(JSON.stringify({ req: bet_id, res: 'bets cancelled by upstream' }));
            return logEventAndEmitResponse(socket, betObj, 'Bet cancelled by upstream', 'bet');
        }

        if (!lobbiesBets[roomId]) lobbiesBets[roomId] = [];
        lobbiesBets[roomId].push(betObj);
        logger.info(JSON.stringify(betObj));

        //Insert into Database
        await insertBets(bet_id);

        parsedPlayerDetails.balance = Number(balance - Number(betAmount)).toFixed(2);
        await setCache(`PL:${socket.id}`, JSON.stringify(parsedPlayerDetails));
        socket.emit('message', { eventName: "info", data: { user_id: userId, operator_id: operatorId, balance: parsedPlayerDetails.balance } });
        return socket.emit('message', { eventName: "bet", data: { message: "Bet Placed successfully" } });
    } catch (err) {
        console.log(err);
        erroredLogger.error(betData, err);
        socket.emit('Bet cannot be placed');
    }
}


const settleBet = async (io, winningNumber, lobbyId) => {
    try {
        const roomId = lobbyId.split('-')[1];
        if (lobbiesBets[roomId]) {
            const bets = lobbiesBets[roomId];
            const settlements = [];
            const uniqueUsers = [];
            const result = getDetailsFromWinningNumber(winningNumber);
            bets.forEach(betData => {
                const { betAmount, chip, id } = betData;
                const winMultiplier = getPayoutMultiplier(chip, winningNumber);
                const winningAmount = Number(betAmount * 0.98) * winMultiplier;
                if (!uniqueUsers.includes(id)) uniqueUsers.push(id);
                settlBetLogger.info(JSON.stringify({ betData, winningAmount, winningNumber, winMultiplier }));
                settlements.push({
                    ...betData,
                    winning_number: winningNumber,
                    max_mult: winMultiplier > 0 ? Number(winMultiplier).toFixed(2) : 0.00,
                    winAmount: winMultiplier > 0 ? Number((betAmount * 0.98) * winMultiplier).toFixed(2) : 0.00
                });
            });
            const userWiseBets = [];
            uniqueUsers.forEach(identifier => userWiseBets.push(settlements.filter(e => e.id == identifier)));
            await Promise.all(userWiseBets.map(async bet => {
                const { socket_id, txn_id, game_id, bet_id, token } = bet[0];
                const [initial, lobby_id, roomId, user_id, operator_id, ...rest] = bet_id.split(':');
                const finalWinAmount = Math.min(bet.reduce((a, b) => a + Number(b.winAmount), 0), appConfig.maxCashoutAmount).toFixed(2);
                if (finalWinAmount > 0) {
                    const socket = io.sockets.sockets.get(socket_id) || null;
                    const webhookData = await prepareDataForWebhook({ user_id, final_amount: finalWinAmount, lobby_id, game_id, txnId: txn_id }, 'CREDIT', socket);
                    creditQueueLogger.info(JSON.stringify({ ...webhookData, operatorId: operator_id, token }))
                    await sendToQueue('', 'games_cashout', JSON.stringify({ ...webhookData, operatorId: operator_id, token }));
                    const cachedPlayerDetails = await getCache(`PL:${socket_id}`);
                    if (cachedPlayerDetails) {
                        const parsedPlayerDetails = JSON.parse(cachedPlayerDetails);
                        parsedPlayerDetails.balance = Number(Number(parsedPlayerDetails.balance) + Number(finalWinAmount)).toFixed(2);
                        await setCache(`PL:${socket_id}`, JSON.stringify(parsedPlayerDetails));
                        io.to(socket_id).emit('message', { eventName: "info", data: { user_id, operator_id, balance: parsedPlayerDetails.balance } });
                    }
                    io.to(socket_id).emit('message', { eventName: 'settlement', data: { message: `You won ${finalWinAmount}`, mywinningAmount: Number(finalWinAmount).toFixed(2), status: 'WIN', result, roomId, lobby_id } });
                } else {
                    const lossAmount = bet.reduce((a, b) => a + Number(b.betAmount), 0).toFixed(2);
                    io.to(socket_id).emit('message', { eventName: 'settlement', data: { message: `You loss ${lossAmount}`, lossAmount, status: 'LOSS', result, roomId, lobby_id } });
                }
            }))
            await addSettleBet(settlements);
            delete lobbiesBets[roomId];
        };
    } catch (error) {
        console.error('Error settling bets:', error);
    }
};

module.exports = { placeBet, setCurrentLobby, settleBet };
