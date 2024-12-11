const { write } = require('../../utilities/db-connection');

const SQL_INSERT_LOBBIES = 'INSERT INTO lobbies (lobby_id, start_delay, end_delay, result) values(?,?,?,?)';

const insertLobbies = async (data) => {
    try {
        if (data.time) delete data.time;
        await write(SQL_INSERT_LOBBIES, [...Object.values(data)]);
    } catch (err) {
        console.error(err)
    }
}

module.exports = { insertLobbies };