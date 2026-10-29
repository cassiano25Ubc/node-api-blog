import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';
import { clearMailbox, getMessageText, listMessages } from '../helpers/mailpit.js';

describe('reply e-mail notification', () => {
  const app = createApp();
  const originalSmtpPort = process.env.SMTP_PORT;

  beforeEach(async () => {
    await cleanDatabase();
    await clearMailbox();
  });

  afterEach(() => {
    if (originalSmtpPort === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = originalSmtpPort;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  async function registerUser(name: string, email: string) {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password: 'secret1' });

    return response.body as { token: string; user: { id: number } };
  }

  async function createPost(token: string) {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My post', content: 'Content' });

    return response.body as { id: number };
  }

  function reply(postId: number, token: string, content: string) {
    return request(app)
      .post(`/api/posts/${postId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });
  }

  it('sends an e-mail to the post author when another user replies', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await reply(post.id, bob.token, 'Nice post!');

    expect(response.status).toBe(201);

    const messages = await listMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].To.map((to) => to.Address)).toEqual(['alice@example.com']);
    expect(messages[0].Subject).toContain('My post');

    const message = await getMessageText(messages[0].ID);
    expect(message.Text).toContain('Bob');
    expect(message.Text).toContain('Nice post!');
    expect(message.Text).not.toContain('secret1');
    expect(message.Text).not.toContain(bob.token);
    expect(message.Text).not.toContain(alice.token);
  });

  it('does not send an e-mail when the author replies to their own post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(alice.token);

    const response = await reply(post.id, alice.token, 'Self reply');

    expect(response.status).toBe(201);
    expect(await listMessages()).toHaveLength(0);
  });

  it('does not send an e-mail when the reply is invalid', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await reply(post.id, bob.token, '');

    expect(response.status).toBe(400);
    expect(await listMessages()).toHaveLength(0);
  });

  it('still creates the reply when the SMTP server is unavailable', async () => {
    process.env.SMTP_PORT = '1';
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await reply(post.id, bob.token, 'Still saved');

    expect(response.status).toBe(201);
    expect(response.body.content).toBe('Still saved');
    expect(await listMessages()).toHaveLength(0);
  });

  it('escapes HTML in the reply content', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    await reply(post.id, bob.token, '<script>alert(1)</script>');

    const [message] = await listMessages();
    const body = await getMessageText(message.ID);
    expect(body.HTML).not.toContain('<script>');
    expect(body.HTML).toContain('&lt;script&gt;');
  });
});
