import { Worker } from 'bullmq';
import { NodemailerMailer } from '../../mail/nodemailer-mailer.js';
import type { NewReplyEmailInput } from '../../mail/new-reply-email.js';
import { redisConnection } from '../connection.js';
import { createReplyNotificationProcessor } from './processor.js';
import { REPLY_NOTIFICATION_QUEUE_NAME } from './queue.js';

export function startReplyNotificationWorker() {
  const worker = new Worker<NewReplyEmailInput>(
    REPLY_NOTIFICATION_QUEUE_NAME,
    createReplyNotificationProcessor(new NodemailerMailer()),
    { connection: redisConnection },
  );

  worker.on('failed', (job, error) => {
    console.error(`Failed to send reply notification (job ${job?.id})`, error);
  });

  return worker;
}
