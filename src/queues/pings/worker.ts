import { Worker } from "bullmq";
import { PING_QUEUE_NAME } from "./queue.js";
import { processPing } from "./processor.js";
import { redisConnection } from "../connection.js";

export function startPingWorker() {
    return new Worker(PING_QUEUE_NAME, processPing,{
        connection: redisConnection
    })
}