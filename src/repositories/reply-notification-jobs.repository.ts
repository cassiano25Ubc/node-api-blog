import type { NewReplyEmailInput } from '../mail/new-reply-email.js';

export type ReplyNotificationJobData = NewReplyEmailInput;

export interface ReplyNotificationJobsRepository {
  enqueue(data: ReplyNotificationJobData): Promise<void>;
}
