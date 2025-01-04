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

// const placeBet = async (io, socket, betData) => {
//     const playerDetails = await getCache(`PL:${socket.id}`);
//     if (!playerDetails) return socket.emit('message', { eventName: 'betError', data: { message: 'Invalid Player Details', status: false } });
//     const parsedPlayerDetails = JSON.parse(playerDetails);
//     const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;
//     const lobbyId = betData[0];
//     const roomId = Number(betData[2]);
//     const userBets = betData[1].split(',');
//     const bet_id = `BT:${lobbyId}:${roomId}:${userId}:${operatorId}`;
//     const betObj = { bet_id, token, socket_id: parsedPlayerDetails.socketId, game_id, roomId, lobby_id: lobbyId };
//     const rooms = [101, 102, 103, 104];
//     console.log(lobbies[roomId], "okk");
//     if(lobbies[roomId].lobbyId !== lobbyId || lobbies[roomId].status != 0) return logEventAndEmitResponse(socket, betObj, 'Invalid Bet', 'bet');
//     if(!rooms.includes(roomId)) return logEventAndEmitResponse(socket, betObj, 'Invalid Room Id Passed', 'bet');
//     let isBetInvalid = 0;
//     let totalBetAmount = 0;
//     const bets = [];
//     userBets.map(bet => {
//         const [chip, betAmount] = bet.split('-');
//         const data = { betAmount, chip };
//         if(betAmount < Number(appConfig.minBetAmount) || betAmount > Number(appConfig.maxBetAmount)) isBetInvalid = 1;
//         totalBetAmount += Number(betAmount);
//         bets.push(data);
//     });

//     if(isBetInvalid) return logEventAndEmitResponse(socket, betObj, 'Invalid Bet Amount', 'bet');

//     if (Number(totalBetAmount) > Number(balance)) {
//         return logEventAndEmitResponse(socket, betObj, 'Insufficient Balance', 'bet');
//     }

//     Object.assign(betObj, { bet_amount: totalBetAmount, userBets: bets });
//     const webhookData = await prepareDataForWebhook({ lobby_id: lobbyId, betAmount: totalBetAmount, game_id, bet_id, user_id: userId }, "DEBIT", socket);
//     betObj.txn_id = webhookData.txn_id;

//     try {
//         await postDataToSourceForBet({ webhookData, token, socketId: socket.id });
//     } catch (err) {
//         failedBetsLogger.error(JSON.stringify({ req: bet_id, res: 'bets cancelled by upstream' }));
//         return logEventAndEmitResponse(socket, betObj, 'Bet cancelled by upstream', 'bet');
//     }

//     const existingBets = JSON.parse(await getCache(`CG:${roomId}:BETS`)) || [];
//     existingBets.push(betObj);
//     await setCache(`CG:${roomId}:BETS`, JSON.stringify(existingBets));
//     logger.info(JSON.stringify(betObj));

//     //Insert into Database
//     await insertBets({
//         totalBetAmount,
//         bet_id,
//         userBets: betObj.userBets,
//     });

//     parsedPlayerDetails.balance = Number(balance - Number(totalBetAmount)).toFixed(2);
//     await setCache(`PL:${socket.id}`, JSON.stringify(parsedPlayerDetails));
//     socket.emit('message', { eventName: "info", data: { user_id: userId, operator_id: operatorId, balance: parsedPlayerDetails.balance } });
//     return socket.emit('message', { eventName: "bet", data: { message: "Bet Placed successfully" } });
// }

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
        const betObj = { id, bet_id, token, socket_id: parsedPlayerDetails.socketId, game_id };
        const rooms = [101, 102, 103, 104];
        if (lobbies[roomId]?.lobbyId !== lobbyId || lobbies[roomId].status != 0) return logEventAndEmitResponse(socket, betObj, 'Invalid Lobby Id Passed', 'bet');
        if ((Date.now() - lobbyTime) / 1000 > 25) return logEventAndEmitResponse(socket, betObj, 'Lobby timed out', 'bet');
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
            await Promise.all(bets.map(async betData => {
                const { bet_id, socket_id, token, game_id, txn_id } = betData;
                const [initial, lobby_id, roomId, user_id, operator_id, betAmount, chip] = bet_id.split(':');
                const winMultiplier = getPayoutMultiplier(chip, winningNumber);
                const result = getDetailsFromWinningNumber(winningNumber);
                const winningAmount = Number(Math.min((Number(betAmount) * winMultiplier), appConfig.maxCashoutAmount)).toFixed(2);
                if (winningAmount > 0) {
                    const socket = io.sockets.sockets.get(socket_id) || null;
                    const webhookData = await prepareDataForWebhook({ user_id, final_amount: winningAmount, lobby_id, game_id, txnId: txn_id }, 'CREDIT', socket);
                    creditQueueLogger.info(JSON.stringify({ ...webhookData, operatorId: operator_id, token }))
                    await sendToQueue('', 'games_cashout', JSON.stringify({ ...webhookData, operatorId: operator_id, token }));
                    const cachedPlayerDetails = await getCache(`PL:${socket_id}`);
                    if (cachedPlayerDetails) {
                        const parsedPlayerDetails = JSON.parse(cachedPlayerDetails);
                        parsedPlayerDetails.balance = Number(Number(parsedPlayerDetails.balance) + Number(winningAmount)).toFixed(2);
                        await setCache(`PL:${socket_id}`, JSON.stringify(parsedPlayerDetails));
                        io.to(socket_id).emit('message', { eventName: "info", data: { user_id, operator_id, balance: parsedPlayerDetails.balance } });
                    }
                    io.to(socket_id).emit('message', { eventName: 'settlement', data: { message: `You won ${winningAmount}`, mywinningAmount: Number(winningAmount).toFixed(2), status: 'WIN', result, roomId } });
                } else {
                    io.to(socket_id).emit('message', { eventName: 'settlement', data: { message: `You loss ${betAmount}`, lossAmount: Number(betAmount).toFixed(2), status: 'LOSS', result, roomId } });
                }

                settlBetLogger.info(JSON.stringify({ betData, winningAmount, winningNumber, winMultiplier }));
                settlements.push({
                    bet_id: betData.bet_id,
                    winning_number: winningNumber,
                    max_mult: winMultiplier > 0 ? Number(winMultiplier).toFixed(2) : 0.00,
                    winAmount: winMultiplier > 0 ? Number(betAmount * winMultiplier).toFixed(2) : 0.00
                });
            }));
            await addSettleBet(settlements);
            delete lobbiesBets[roomId];
        };
    } catch (error) {
        console.error('Error settling bets:', error);
    }
};

module.exports = { placeBet, setCurrentLobby, settleBet };
