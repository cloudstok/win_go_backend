const { placeBet } = require("../module/bets/bets-message");
const createLogger = require('../utilities/logger');
const logger = createLogger('Event');

const messageRouter = async (io, socket) => {
    socket.on('message', (data) => {
        logger.info(data);
        const event = data.split(':')
        switch (event[0]) {
            case 'PB': return placeBet(io, socket, event.slice(1, event.length));
        }
    })
}


module.exports = { messageRouter }
