const axios = require('axios');
const crypto = require('crypto');
const getLogger = require('../utilities/logger');
const { variableConfig } = require('./load-config');
const thirdPartyLogger = getLogger('ThirdPartyAPICalls', 'jsonl');
const failedLogger = getLogger('FailedThirdPartyAPICalls', 'jsonl');

function generateUUIDv7() {
    const timestamp = Date.now();
    const timeHex = timestamp.toString(16).padStart(12, '0');
    const randomBits = crypto.randomBytes(8).toString('hex').slice(2);
    const uuid = [
        timeHex.slice(0, 8),  
        timeHex.slice(8) + randomBits.slice(0, 4),  
        '7' + randomBits.slice(4, 7),  
        (parseInt(randomBits.slice(7, 8), 16) & 0x3f | 0x80).toString(16) + randomBits.slice(8, 12),  
        randomBits.slice(12) 
    ];

    return uuid.join('-');
}


const postDataToSourceForBet = async (data) => {
    try {
        return new Promise((resolve, reject) => {
            const { webhookData, token, socketId } = data;
            const url = process.env.service_base_url;
            let clientServerOptions = {
                method: 'POST',
                url: `${url}/service/operator/user/balance/v2`,
                headers: {
                    token
                },
                data: webhookData,
                timeout: 1000 * 10
            };
            axios(clientServerOptions).then((result) => {
                thirdPartyLogger.info(JSON.stringify({ req: data, res: result?.data }));
                resolve({ status: result.status, ...webhookData, socketId });
            }).catch((err) => {
                console.log(`[ERR] received from upstream server`, err);
                let response = err.response ? err.response?.data : 'Something went wrong';
                failedLogger.error(JSON.stringify({ req: { webhookData, token }, res: response}));
                reject({...webhookData, socketId});
            })
        })
    } catch (err) {
        console.error(`[ERR] while posting data to source is:::`, err);
        failedLogger.error(JSON.stringify({ req: data, res: `Something went wrong`}));
        return false
    }
}


const prepareDataForWebhook = async(betObj, key, socket)=> {
    try{
        let { lobby_id, betAmount, game_id, bet_id, final_amount, user_id, txnId} = betObj;
        let userIP = socket?.handshake?.address || "";
        if (socket && socket.handshake.headers['x-forwarded-for']) {
            userIP = socket.handshake.headers['x-forwarded-for'].split(',')[0].trim();
        }
        let obj = {
            amount: Number(betAmount).toFixed(2),
            txn_id: generateUUIDv7(),
            ip : userIP,
            game_id,
            user_id: decodeURIComponent(user_id)
        }
        switch (key) {
            case "DEBIT":
                obj.description = `${obj.amount} debited for Instant Lottery game for Round ${lobby_id}`;
                obj.bet_id = bet_id;
                obj.txn_type = 0;
                break;
            case "CREDIT":
                obj.amount = final_amount;
                obj.txn_ref_id = txnId;
                obj.description = `${final_amount} credited for Instant Lottery game for Round ${lobby_id}`;
                obj.txn_type = 1;
                break;
            default:
                obj
        }
        return obj;
    } catch (err) {
        console.error(`[ERR] while trying to prepare data for webhook is::`, err);
        return false
    }
}

const halls = [
    {
        id: 1,
        min: 10,
        max: 200,
        chips: [10, 20, 30, 50, 100, 200]
    },
    {
        id: 2,
        min: 20,
        max: 400,
        chips: [20, 30, 50, 100, 200, 400]
    },
    {
        id: 3,
        min: 30,
        max: 600,
        chips: [30, 50, 100, 200, 400, 600]
    },
    {
        id: 4,
        min: 50,
        max: 1000,
        chips: [50, 100, 200, 400, 600, 1000]
    },
    {
        id: 5,
        min: 100,
        max: 2000,
        chips: [100, 200, 400, 600, 1000, 2000]
    },
    {
        id: 6,
        min: 200,
        max: 4000,
        chips: [200, 400, 600, 1000, 2000, 4000]
    }
]

const getHalls = () => {
    return variableConfig.games_templates && variableConfig.games_templates.length > 0 ? variableConfig.games_templates : halls;
}


module.exports = { postDataToSourceForBet, prepareDataForWebhook, generateUUIDv7, getHalls }