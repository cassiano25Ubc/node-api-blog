import type { MailMessage } from './mailer.js';

export type NewReplyEmailInput = {
  to: string;
  postAuthorName: string;
  postTitle: string;
  replyAuthorName: string;
  replyContent: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildNewReplyEmail(input: NewReplyEmailInput): MailMessage {
  const { to, postAuthorName, postTitle, replyAuthorName, replyContent } = input;

  return {
    to,
    subject: `Nova resposta no seu post: ${postTitle}`.replace(/[\r\n]+/g, ' '),
    text: `Olá, ${postAuthorName}!\n\n${replyAuthorName} respondeu ao seu post "${postTitle}":\n\n${replyContent}\n`,
    html:
      `<p>Olá, ${escapeHtml(postAuthorName)}!</p>` +
      `<p><strong>${escapeHtml(replyAuthorName)}</strong> respondeu ao seu post ` +
      `&quot;${escapeHtml(postTitle)}&quot;:</p>` +
      `<blockquote>${escapeHtml(replyContent)}</blockquote>`,
  };
}
