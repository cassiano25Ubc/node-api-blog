import { Queue } from 'bullmq';
import { redisConnection } from '../connection.js';

export const PING_QUEUE_NAME = "pings";

export const pingsQueue = new Queue(PING_QUEUE_NAME, {
    connection: redisConnection
});