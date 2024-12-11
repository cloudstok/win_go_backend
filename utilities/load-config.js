const { read } = require("./db-connection");

const variableConfig = {
    games_templates: []
}

const loadConfig = async () => {
    const data = await read(`SELECT * FROM game_templates WHERE is_active = 1`, []);
    variableConfig.games_templates = data ? data.map(e=> JSON.parse(e.data)) : [];
    console.log("DB Variables loaded in cache");
};


module.exports = { variableConfig, loadConfig};