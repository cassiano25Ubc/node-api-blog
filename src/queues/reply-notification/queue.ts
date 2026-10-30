import { Queue } from 'bullmq';
import type { NewReplyEmailInput } from '../../mail/new-reply-email.js';
import { redisConnection } from '../connection.js';

export const REPLY_NOTIFICATION_QUEUE_NAME = 'new-reply-notification';
export const REPLY_NOTIFICATION_JOB_NAME = 'sendReplyNotification';

export const replyNotificationQueue = new Queue<NewReplyEmailInput>(
  REPLY_NOTIFICATION_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  },
);
