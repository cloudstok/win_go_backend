const client = require("amqplib");
const createLogger = require('../utilities/logger');
const rabbitMQLogger = createLogger('Queue');

let pubChannel, subChannel = null;
let connected = false;
const { AMQP_CONNECTION_STRING } = process.env;

async function initQueue() {
    await connect();
}

async function connect() {
    if (connected && pubChannel && subChannel) return;
    try {
        rabbitMQLogger.info("⌛️ Connecting to Rabbit-MQ Server", AMQP_CONNECTION_STRING.split('@')[1]);
        const connection = await client.connect(AMQP_CONNECTION_STRING);
        rabbitMQLogger.info("✅ Rabbit MQ Connection is ready");
        [pubChannel, subChannel] = await Promise.all([
            connection.createChannel(),
            connection.createChannel()
        ]);
        pubChannel.removeAllListeners('close');
        pubChannel.removeAllListeners('error');
        subChannel.removeAllListeners('close');
        subChannel.removeAllListeners('error');
        pubChannel.on('close',async ()=>{ console.error("pubChannel Closed") ;  pubChannel = null; connected= false; });
        subChannel.on('close',async ()=>{ console.error("subChannel Closed") ;  subChannel = null; connected= false; /*initQueue*/ });
        pubChannel.on('error',async (msg)=>{ console.error("pubChannel Error" , msg); });
        subChannel.on('error',async (msg)=>{ console.error("subChannel Error" , msg); initQueue() });
        rabbitMQLogger.info("🛸 Created RabbitMQ Channel successfully");
        connected = true;
    } catch (error) {
        rabbitMQLogger.error(error);
        rabbitMQLogger.error("Not connected to MQ Server");
    }
}

async function sendToQueue(exchange, queueName, message, delay = 0, retries = 0) {
    try {
        if (!pubChannel) {
            await connect();
        }
        await pubChannel.assertQueue(queueName, { durable: true });
        pubChannel.publish(exchange, queueName, Buffer.from(message), {
            headers: { "x-delay": delay, "x-retries": retries }, persistent: true
        });
        rabbitMQLogger.info(`Message sent to ${queueName} queue on exchange ${exchange}`);
    } catch (error) {
        rabbitMQLogger.error(`Failed to send message to ${queueName} queue on exchange ${exchange}: ${error.message}`);
        throw error;
    }
}


module.exports = {
    initQueue,
    sendToQueue,
    connect
};