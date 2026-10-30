import { Queue } from 'bullmq';
import { redisConnection } from '../connection.js';

export const REPLY_NOTIFICATION_QUEUE_NAME =
  process.env.NODE_ENV === 'test' ? 'reply-notification-test' : 'reply-notification';
export const REPLY_NOTIFICATION_JOB_NAME = 'sendReplyNotification';


export const replyNotificationQueue = new Queue( REPLY_NOTIFICATION_QUEUE_NAME,{
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 5,
      removeOnComplete: true,
      removeOnFail: false,
       backoff: { 
        type: 'exponential', 
        delay: 1000 },
    },
  },
);
