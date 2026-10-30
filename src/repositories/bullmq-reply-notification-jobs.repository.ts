import type { NewReplyEmailInput } from '../mail/new-reply-email.js';
import {
  REPLY_NOTIFICATION_JOB_NAME,
  replyNotificationQueue,
} from '../queues/reply-notification/queue.js';
import type { ReplyNotificationJobsRepository } from './reply-notification-jobs.repository.js';

export class BullmqReplyNotificationJobsRepository implements ReplyNotificationJobsRepository {
  async enqueue(payload: NewReplyEmailInput): Promise<void> {
    await replyNotificationQueue.add(REPLY_NOTIFICATION_JOB_NAME, payload);
  }
}
