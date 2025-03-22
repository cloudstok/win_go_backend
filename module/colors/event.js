const sleep = ms => new Promise(r => setTimeout(r, ms));
const { insertLobbies } = require('./db');
const createLogger = require('../../utilities/logger');
const { setCurrentLobby, settleBet } = require('../bets/bets-message');
const logger = createLogger('Color', 'jsonl');

const initColor = async (io) => {
    logger.info("lobby started");
    const delays = [30, 60, 180, 300];
    delays.forEach((delay, index) => {
        const results = getResultNumber();
        initLobby(io, delay, index + 101, results);
    })
};

function getSingleResult(array, index){
    let value = 0;
    switch(index){
        case 101: value = array[0];
        case 102: value = array[1];
        case 103: value = array[2];
        case 104: value = array[3];
        default: value;
    };
    return value;
}

function getResultNumber() {
    let set = new Set()
    while ([...set].length !== 4) {
        set.add(Math.floor(Math.random() * 10))
    }
    return [...set];
}

const initLobby = async (io, delay, lobbyNumber, results) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1 + '';
    const day = date.getDate() + '';
    const formattedMonth = month.length == 1 ? `0${month}` : month;
    const formattedDay = day.length == 1 ? `0${day}` : day;
    const lobbyId = `${year}${formattedMonth}${formattedDay}${Date.now()}-${lobbyNumber}`;

    let recurLobbyData = { lobbyId, status: 0 };

    setCurrentLobby(lobbyNumber, recurLobbyData);
    let start_delay = delay;
    const result = getSingleResult(results, lobbyNumber);
    const end_delay = 2;

    for (let x = start_delay; x > 0; x--) {
        io.emit("color", `${lobbyId}:${start_delay}:STARTING`);
        start_delay--;
        await sleep(1000);
    }


    recurLobbyData['status'] = 1;
    setCurrentLobby(lobbyNumber, recurLobbyData);
    io.emit('color', `${lobbyId}:${result}:RESULT`);

    await settleBet(io, result, lobbyId);

    recurLobbyData['status'] = 2;
    setCurrentLobby(lobbyNumber, recurLobbyData);
    for (let z = 1; z <= end_delay; z++) {
        io.emit("color", `${lobbyId}:${z}:ENDED`);
        await sleep(1000);
    }

    const history = { time: new Date(), lobbyId, roomId: Number(lobbyId.split('-')[1]), start_delay: delay, end_delay, result };
    io.emit("history", JSON.stringify({ roomId: history.roomId, result }));
    logger.info(JSON.stringify(history));
    await insertLobbies(history);
    return initLobby(io, delay, lobbyNumber, getResultNumber());
}

module.exports = { initColor }
