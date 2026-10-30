import type { NewReplyEmailInput } from '../mail/new-reply-email.js';
import { NEW_REPLY_EMAIL_JOB_NAME, newReplyEmailQueue } from '../queues/new-reply-email/queue.js';
import type { NewReplyEmailJobsRepository } from './new-reply-email-jobs.repository.js';

export class BullmqNewReplyEmailJobsRepository implements NewReplyEmailJobsRepository {
  async enqueue(payload: NewReplyEmailInput): Promise<void> {
    await newReplyEmailQueue.add(NEW_REPLY_EMAIL_JOB_NAME, payload);
  }
}
