import { Worker } from 'bullmq';
import { NodemailerMailer } from '../../mail/nodemailer-mailer.js';
import type { NewReplyEmailInput } from '../../mail/new-reply-email.js';
import { redisConnection } from '../connection.js';
import { createNewReplyEmailProcessor } from './processor.js';
import { NEW_REPLY_EMAIL_QUEUE_NAME } from './queue.js';

export function startNewReplyEmailWorker() {
  const worker = new Worker<NewReplyEmailInput>(
    NEW_REPLY_EMAIL_QUEUE_NAME,
    createNewReplyEmailProcessor(new NodemailerMailer()),
    { connection: redisConnection },
  );

  worker.on('failed', (job, error) => {
    console.error(`Failed to send reply notification e-mail (job ${job?.id})`, error);
  });

  return worker;
}
