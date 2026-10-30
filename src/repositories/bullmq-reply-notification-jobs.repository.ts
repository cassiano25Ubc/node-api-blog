import {
  REPLY_NOTIFICATION_JOB_NAME,
  replyNotificationQueue,
} from '../queues/reply-notification/queue.js';
import type {
  ReplyNotificationJobData,
  ReplyNotificationJobsRepository,
} from './reply-notification-jobs.repository.js';

export class BullmqReplyNotificationJobsRepository implements ReplyNotificationJobsRepository {
  async enqueue(data: ReplyNotificationJobData): Promise<void> {
    await replyNotificationQueue.add(REPLY_NOTIFICATION_JOB_NAME, data);
  }
}
