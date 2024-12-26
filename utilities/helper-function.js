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
    10: 'gr',
    11: 'vl',
    12: 'rd'
};

const numChips = {
    13: [5, 6, 7, 8, 9],
    14: [0, 1, 2, 3, 4]
}

// Constants for multipliers
const MULTIPLIERS = {
    numberMatch: 9.0,
    colorMatch: 2.0,
    violetMatch: 2.0,
    bonusMatch: 1.5,
    sizeMatch: 2.0
};

const getPayoutMultiplier = (chip, winningNumber) =>{
    const chipNum = Number(chip);
    const winningNum = Number(winningNumber);
    if (chipNum === winningNum) return MULTIPLIERS.numberMatch;
    const chipSize = numChips[chipNum];
    if(chipSize && chipSize.includes(winningNum)) return MULTIPLIERS.sizeMatch;
    const chipColor = colorChips[chipNum];
    const winningColor = colorMap[winningNum];
    if (!chipColor || !winningColor) return 0;
    if (winningColor === chipColor) return MULTIPLIERS.colorMatch;
    if (winningColor.split('-').includes(chipColor)) {
        return chipColor === 'vl' ? MULTIPLIERS.violetMatch : MULTIPLIERS.bonusMatch;
    }
    return 0;
}
const getDetailsFromWinningNumber = (num) => {
    const resultData = {
        color: colorMap[num],
        winningNumber: num,
    };
    resultData['category'] = numChips['13'].includes(num) ? 'BIG' : 'SMALL'
    switch (resultData['color']){
        case 'gr' : 
            resultData['color'] = 'Green'
        break;
        case 'rd' :
            resultData['color'] = 'Red'
        break;
        case 'rd-vl' :
            resultData['color'] = 'Red-Violet'
        break;
        case 'gr-vl' :
            resultData['color'] = 'Green-Voilet'
        break;
        default :
            resultData['color'] = ''
    };
    return resultData;
}


module.exports = { logEventAndEmitResponse, getPayoutMultiplier, getPayoutMultiplier, getDetailsFromWinningNumber }
