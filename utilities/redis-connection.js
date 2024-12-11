const Redis = require('ioredis');
require('dotenv').config();
const { appConfig } = require('./app-config');
const { host, port, retry, interval } = appConfig.redis;
const createLogger = require('../utilities/logger');
const logger = createLogger('Redis')

const redisConfig = {
    host: host || '127.0.0.1',
    port: port || 6379,
    password: process.env.REDIS_PASSWORD || undefined // Optional, if Redis is password-protected
};

const maxRetries = retry;
const retryInterval = interval; 

let redisClient;

const createRedisClient = () => {
    const client = new Redis(redisConfig);

    client.on('error', (err) => {
        logger.error(`REDIS ERROR: ${err.message}`);
    });

    client.on('connect', () => {
        logger.info('REDIS CONNECTION ESTABLISHED');
    });

    client.on('close', () => {
        logger.info('REDIS CONNECTION CLOSED');
    });

    return client;
};

const initializeRedis = async () => {
    let retries = 0;

    while (retries < maxRetries) {
        try {
            redisClient = createRedisClient();
            await redisClient.set('test', 'test'); // Test connection
            await redisClient.del('test'); // Clean up
            logger.info("REDIS CONNECTION SUCCESSFUL");
            return redisClient;
        } catch (err) {
            retries += 1;
            logger.error(`REDIS CONNECTION FAILED. Retry ${retries}/${maxRetries}. Error: ${err.message}`);
            if (retries >= maxRetries) {
                logger.error("Maximum retries reached. Could not connect to Redis.");
                process.exit(1); // Exit the application with failure
            }
            await new Promise(res => setTimeout(res, retryInterval));
        }
    }
};

// Redis Operations
const setCache = async (key, value, expiration = 3600 * 24 * 1000) => {
    if (!redisClient) await initializeRedis();
    try {
        await redisClient.set(key, value, 'EX', expiration);
    } catch (error) {
        logger.error('Failed to set cache:', error.message);
    }
};

const getCache = async (key) => {
    if (!redisClient) await initializeRedis();
    try {
        const value = await redisClient.get(key);
        if (value) {
            return value;
        } else {
            logger.info(`Cache not found: ${key}`);
            return null;
        }
    } catch (error) {
        logger.error('Failed to get cache:', error.message);
        return null;
    }
};

const deleteCache = async (key) => {
    if (!redisClient) await initializeRedis();
    try {
        await redisClient.del(key);
    } catch (error) {
        logger.error('Failed to delete cache:', error.message);
    }
};

const incrementCache = async (key, amount = 1) => {
    if (!redisClient) await initializeRedis();
    try {
        const newValue = await redisClient.incrby(key, amount);
        return newValue;
    } catch (error) {
        logger.error('Failed to increment cache:', error.message);
        return null;
    }
};

const setHashField = async (hash, field, value) => {
    if (!redisClient) await initializeRedis();
    try {
        await redisClient.hset(hash, field, value);
    } catch (error) {
        logger.error('Failed to set hash field:', error.message);
    }
};

const getHashField = async (hash, field) => {
    if (!redisClient) await initializeRedis();
    try {
        const value = await redisClient.hget(hash, field);
        if (value) {
            return value;
        } else {
            return null;
        }
    } catch (error) {
        logger.error('Failed to get hash field:', error.message);
        return null;
    }
};


module.exports = {
    initializeRedis,
    setCache,
    getCache,
    deleteCache,
    incrementCache,
    setHashField,
    getHashField
};
