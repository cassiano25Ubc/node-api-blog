import type { NewReplyEmailInput } from '../mail/new-reply-email.js';

export interface NewReplyEmailJobsRepository {
  enqueue(payload: NewReplyEmailInput): Promise<void>;
}
