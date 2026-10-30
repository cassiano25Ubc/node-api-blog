import type { NewReplyEmailInput } from '../mail/new-reply-email.js';

export interface ReplyNotificationJobsRepository {
  enqueue(payload: NewReplyEmailInput): Promise<void>;
}
