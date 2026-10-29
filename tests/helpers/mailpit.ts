const apiUrl = () => process.env.MAIL_API_URL ?? 'http://localhost:8025';

export type MailpitMessage = {
  ID: string;
  Subject: string;
  From: { Address: string };
  To: { Address: string }[];
  Snippet: string;
};

export async function clearMailbox(): Promise<void> {
  await fetch(`${apiUrl()}/api/v1/messages`, { method: 'DELETE' });
}

export async function listMessages(): Promise<MailpitMessage[]> {
  const response = await fetch(`${apiUrl()}/api/v1/messages`);
  const body = (await response.json()) as { messages: MailpitMessage[] };

  return body.messages;
}

export async function getMessageText(id: string): Promise<{ Text: string; HTML: string }> {
  const response = await fetch(`${apiUrl()}/api/v1/message/${id}`);

  return (await response.json()) as { Text: string; HTML: string };
}
