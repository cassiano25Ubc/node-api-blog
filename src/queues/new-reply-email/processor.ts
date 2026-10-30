import type { Job } from 'bullmq';
import type { Mailer } from '../../mail/mailer.js';
import { buildNewReplyEmail, type NewReplyEmailInput } from '../../mail/new-reply-email.js';

export function createNewReplyEmailProcessor(mailer: Mailer) {
  return async (job: Job<NewReplyEmailInput>): Promise<void> => {
    await mailer.send(buildNewReplyEmail(job.data));
  };
}
