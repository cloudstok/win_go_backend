const { prepareDataForWebhook, postDataToSourceForBet, getHalls } = require('../../utilities/common-function');
const { addSettleBet, insertBets, insertStatsData } = require('./bets-db');
const { appConfig } = require('../../utilities/app-config');
const { deleteCache, setCache, getCache } = require('../../utilities/redis-connection');
const { logEventAndEmitResponse, getPayoutMultiplier } = require('../../utilities/helper-function');
const getLogger = require('../../utilities/logger');
const { sendToQueue } = require('../../utilities/amqp');
const logger = getLogger('Bets', 'jsonl');
const settlBetLogger = getLogger('Settlement', 'jsonl');
const failedBetsLogger = getLogger('userFailedBets', 'log');
const creditQueueLogger = getLogger('CreditQueue', 'jsonl');


let lobbyData = {};

const setCurrentLobby = (data) => {
    lobbyData = data;
};

const placeBet = async (io, socket, betData) => {
    const playerDetails = await getCache(`PL:${socket.id}`);
    if (!playerDetails) return socket.emit('message', { eventName: 'betError', data: { message: 'Invalid Player Details', status: false } });
    const parsedPlayerDetails = JSON.parse(playerDetails);
    const { userId, operatorId, token, game_id, balance } = parsedPlayerDetails;
    const roomId = Number(betData[1]);
    const userBets = betData[0].split(',');
    const bet_id = `BT:${userId}:${operatorId}`;
    const betObj = { bet_id, token, socket_id: parsedPlayerDetails.socketId, game_id, roomId };
    const halls = getHalls();
    const roomDetails = halls.find(room => room.id == [Number(roomId)]);
    if (!roomDetails) return logEventAndEmitResponse(socket, betObj, 'Invalid Room Id Passed', 'bet');
    let totalBetAmount = 0;
    let isBetInvalid = 0;
    const bets = [];
    userBets.map(bet => {
        const [lobby_id, betAmount, chip] = bet.split('-');
        const data = { betAmount, chip };
        if (!roomDetails.chips.includes(Number(betAmount))) isBetInvalid = 1;
        if (Number(betAmount) < roomDetails.min || Number(betAmount) > roomDetails.max) isBetInvalid = 1;
        if (lobbyData.lobbyId != lobby_id && lobbyData.status != 0) isBetInvalid = 1;
        totalBetAmount += Number(betAmount);
        bets.push(data);
    });

    if(totalBetAmount < Number(appConfig.minBetAmount) || totalBetAmount > Number(appConfig.maxBetAmount)) return logEventAndEmitResponse(socket, betObj, 'Invalid Bet Amount', 'bet');

    if(isBetInvalid){
        return logEventAndEmitResponse(socket, betObj, 'Invalid Bet', 'bet');
    }

    if (Number(totalBetAmount) > Number(balance)) {
        return logEventAndEmitResponse(socket, betObj, 'Insufficient Balance', 'bet');
    }
    
    Object.assign(betObj, { bet_amount: totalBetAmount, userBets: bets, lobby_id: lobbyData.lobbyId });
    const webhookData = await prepareDataForWebhook({ lobby_id: lobbyData.lobbyId, betAmount: totalBetAmount, game_id, bet_id, user_id: userId }, "DEBIT", socket);
    betObj.txn_id = webhookData.txn_id;

    try {
        await postDataToSourceForBet({ webhookData, token, socketId: socket.id });
    } catch (err) {
        failedBetsLogger.error(JSON.stringify({ req: bet_id, res: 'bets cancelled by upstream' }));
        return logEventAndEmitResponse(socket, betObj, 'Bet cancelled by upstream', 'bet');
    }

    const existingBets = JSON.parse(await getCache(`CG:BETS`)) || [];
    existingBets.push(betObj);
    await setCache(`CG:BETS`, JSON.stringify(existingBets));
    logger.info(JSON.stringify({ betObj }));

    //Insert into Database
    await insertBets({
        totalBetAmount,
        bet_id,
        roomId,
        lobby_id: betObj.lobby_id,
        userBets: betObj.userBets,
    });

    parsedPlayerDetails.balance = Number(balance - Number(totalBetAmount)).toFixed(2);
    await setCache(`PL:${socket.id}`, JSON.stringify(parsedPlayerDetails));
    socket.emit('message', { eventName: "info", data: { user_id: userId, operator_id: operatorId, balance: parsedPlayerDetails.balance } });
    return socket.emit('message', { eventName: "bet", data: { message: "Bet Placed successfully" } });
}

const settleBet = async (io, winningNumber, lobbyId) => {
    try {
        let oddsData = {
            lobbyId,
            resultTime: new Date().toLocaleTimeString(),
            winCount: Math.floor(Math.random() * (500 - 250 + 1)) + 250,
            winningNumber,
            totalBetAmount: Math.floor(Math.random() * (100000 - 5000 + 1)) + 5000,
        };
        let sessionBetAmount = 0;
        let sessionWinCount = 0;
        let sessionWinAmount = 0;
        const cachedBets = await getCache('CG:BETS');
        if (cachedBets) {
            const bets = JSON.parse(cachedBets);
            const settlements = [];
            await Promise.all(bets.map(async betData => {
                const { bet_id, socket_id, token, game_id, lobby_id, txn_id } = betData;
                const [initial, user_id, operator_id] = bet_id.split(':');
                let finalAmount = 0;
                let totalMultiplier = 0;
                betData['userBets'].map(bet => {
                    const { betAmount, chip } = bet;
                    sessionBetAmount += Number(betAmount);
                    const winMultiplier = getPayoutMultiplier(chip, winningNumber);
                    if (winMultiplier > 0) {
                        sessionWinCount++;
                        totalMultiplier += winMultiplier;
                        const winningAmount = Number(betAmount) * winMultiplier;
                        finalAmount += winningAmount;
                    }
                });
                sessionWinAmount += Number(finalAmount);
                settlements.push({
                    bet_id: betData.bet_id,
                    lobby_id: betData.lobby_id,
                    totalBetAmount: betData.bet_amount,
                    userBets: betData.userBets,
                    roomId: betData.roomId,
                    totalMaxMult: totalMultiplier > 0 ? Number(totalMultiplier).toFixed(2) : 0.00,
                    winAmount: finalAmount > 0 ? Number(finalAmount).toFixed(2) : 0.00
                });
                settlBetLogger.info(JSON.stringify({ betData, finalAmount, winningNumber, totalMultiplier }));
                if (finalAmount > 0) {
                    const winAmount = finalAmount.toFixed(2);
                    const socket = io.sockets.sockets.get(socket_id) || null;
                    const webhookData = await prepareDataForWebhook({ user_id, final_amount: winAmount, lobby_id, game_id, txnId: txn_id }, 'CREDIT', socket);
                    creditQueueLogger.info(JSON.stringify({ ...webhookData, operatorId: operator_id, token }))
                    await sendToQueue('', 'games_cashout', JSON.stringify({ ...webhookData, operatorId: operator_id, token }));
                    const cachedPlayerDetails = await getCache(`PL:${socket_id}`);
                    if (cachedPlayerDetails) {
                        const parsedPlayerDetails = JSON.parse(cachedPlayerDetails);
                        parsedPlayerDetails.balance = Number(Number(parsedPlayerDetails.balance) + Number(winAmount)).toFixed(2);
                        await setCache(`PL:${socket_id}`, JSON.stringify(parsedPlayerDetails));
                        io.to(socket_id).emit('message', { eventName: "info", data: { user_id, operator_id, balance: parsedPlayerDetails.balance } });
                    }
                    io.to(socket_id).emit('message', { eventName: 'settlement', data: { message: `You won ${winAmount}`, mywinningAmount: winAmount } });
                }
            }));
            await addSettleBet(settlements);
            await deleteCache('CG:BETS');
        };
        const TotalBetAmount = Number(oddsData.totalBetAmount + sessionBetAmount).toFixed(2);
        const TotalWinningAmount = Number(((oddsData.totalBetAmount + sessionBetAmount) * 0.25) + sessionWinAmount).toFixed(2);
        Object.assign(oddsData, { totalBetAmount: TotalBetAmount, winCount: oddsData.winCount + sessionWinCount, TotalWinningAmount });
        await insertStatsData({
            lobby_id: oddsData.lobbyId,
            winning_number: winningNumber,
            total_win_count: oddsData.winCount,
            total_bet_amount: oddsData.totalBetAmount,
            total_cashout_amount: oddsData.TotalWinningAmount
        });
        io.emit('message', { eventName: 'bet_history', data: oddsData });
    } catch (error) {
        console.error('Error settling bets:', error);
    }
};



module.exports = { placeBet, setCurrentLobby, settleBet };
