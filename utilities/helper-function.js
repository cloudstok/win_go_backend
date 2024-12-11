const getLogger = require('./logger');
const failedBetLogger = getLogger('failedBets', 'jsonl');

const logEventAndEmitResponse = (socket, req, res, event) => {
    let logData = JSON.stringify({ req, res })
    if (event === 'bet') {
        failedBetLogger.error(logData)
    }
    return socket.emit('message', {eventName: 'betError', data: {message: res, status: false}});
}

const colorMap = {
    0: 'rd-vl',
    1: 'gr',
    2: 'rd',
    3: 'gr',
    4: 'rd',
    5: 'gr-vl',
    6: 'rd',
    7: 'gr',
    8: 'rd',
    9: 'gr'
};

const colorChips = {
    11: 'gr',
    12: 'vl',
    13: 'rd'
};

// Constants for multipliers
const MULTIPLIERS = {
    numberMatch: 9.6,
    colorMatch: 2.0,
    violetMatch: 4.8,
    bonusMatch: 1.6
};

const getPayoutMultiplier = (chip, winningNumber) =>{
    const chipNum = Number(chip);
    const winningNum = Number(winningNumber);
    if (chipNum === winningNum) return MULTIPLIERS.numberMatch;
    const chipColor = colorChips[chipNum];
    const winningColor = colorMap[winningNum];
    if (!chipColor || !winningColor) return 0;
    if (winningColor === chipColor) return MULTIPLIERS.colorMatch;
    if (winningColor.split('-').includes(chipColor)) {
        return chipColor === 'vl' ? MULTIPLIERS.violetMatch : MULTIPLIERS.bonusMatch;
    }
    return 0;
}


module.exports = { logEventAndEmitResponse, getPayoutMultiplier, getPayoutMultiplier }
