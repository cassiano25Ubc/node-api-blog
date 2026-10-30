import { Queue } from 'bullmq';
import type { NewReplyEmailInput } from '../../mail/new-reply-email.js';
import { redisConnection } from '../connection.js';

export const NEW_REPLY_EMAIL_QUEUE_NAME = 'new-reply-email';
export const NEW_REPLY_EMAIL_JOB_NAME = 'sendNewReplyEmail';

export const newReplyEmailQueue = new Queue<NewReplyEmailInput>(NEW_REPLY_EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
