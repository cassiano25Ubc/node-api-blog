import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('GET /api/posts/:id', () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  async function registerUser(name: string, email: string) {
    const response = await request(app).post('/api/auth/register').send({
      name,
      email,
      password: 'secret1',
    });

    return response.body as { token: string; user: { id: number; name: string; email: string } };
  }

  async function createPost(token: string, title = 'Hello', content = 'World') {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title, content });

    return response.body as {
      id: number;
      title: string;
      content: string;
      createdAt: string;
      author: { id: number; name: string };
    };
  }

  it('returns a post by id with author name', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token, 'Public post', 'Public content');

    const response = await request(app).get(`/api/posts/${post.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: post.id,
      title: 'Public post',
      content: 'Public content',
      createdAt: post.createdAt,
      imageUrl: null,
      likesCount: 0,
      likedByMe: false,
      replies: [],
      author: {
        id: user.id,
        name: 'Alice',
      },
    });
    expect(response.body.author.email).toBeUndefined();
    expect(response.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('returns all replies ordered by createdAt asc without pagination', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const first = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: 'First reply' });

    const second = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ content: 'Second reply' });

    const third = await request(app)
      .post(`/api/posts/${post.id}/replies`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: 'Third reply' });

    const response = await request(app).get(`/api/posts/${post.id}`);

    expect(response.status).toBe(200);
    expect(response.body.replies).toEqual([
      {
        id: first.body.id,
        content: 'First reply',
        createdAt: first.body.createdAt,
        author: { id: bob.user.id, name: 'Bob' },
      },
      {
        id: second.body.id,
        content: 'Second reply',
        createdAt: second.body.createdAt,
        author: { id: alice.user.id, name: 'Alice' },
      },
      {
        id: third.body.id,
        content: 'Third reply',
        createdAt: third.body.createdAt,
        author: { id: bob.user.id, name: 'Bob' },
      },
    ]);
    expect(response.body.replies.every((reply: { author: { email?: string } }) => reply.author.email === undefined)).toBe(
      true,
    );
  });

  it('returns only replies that belong to the requested post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const firstPost = await createPost(alice.token, 'First', 'Content 1');
    const secondPost = await createPost(alice.token, 'Second', 'Content 2');

    const ownReply = await request(app)
      .post(`/api/posts/${firstPost.id}/replies`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: 'On first post' });

    await request(app)
      .post(`/api/posts/${secondPost.id}/replies`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: 'On second post' });

    const response = await request(app).get(`/api/posts/${firstPost.id}`);

    expect(response.status).toBe(200);
    expect(response.body.replies).toEqual([
      {
        id: ownReply.body.id,
        content: 'On first post',
        createdAt: ownReply.body.createdAt,
        author: { id: bob.user.id, name: 'Bob' },
      },
    ]);
  });

  it('returns likesCount and likedByMe false without authentication', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token, 'Public post', 'Public content');

    await request(app).post(`/api/posts/${post.id}/likes`).set('Authorization', `Bearer ${alice.token}`);
    await request(app).post(`/api/posts/${post.id}/likes`).set('Authorization', `Bearer ${bob.token}`);

    const response = await request(app).get(`/api/posts/${post.id}`);

    expect(response.status).toBe(200);
    expect(response.body.likesCount).toBe(2);
    expect(response.body.likedByMe).toBe(false);
  });

  it('returns likedByMe true when the authenticated user liked the post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    await request(app).post(`/api/posts/${post.id}/likes`).set('Authorization', `Bearer ${bob.token}`);

    const response = await request(app)
      .get(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(response.status).toBe(200);
    expect(response.body.likesCount).toBe(1);
    expect(response.body.likedByMe).toBe(true);
  });

  it('returns likedByMe false when the authenticated user has not liked the post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    await request(app).post(`/api/posts/${post.id}/likes`).set('Authorization', `Bearer ${alice.token}`);

    const response = await request(app)
      .get(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(response.status).toBe(200);
    expect(response.body.likesCount).toBe(1);
    expect(response.body.likedByMe).toBe(false);
  });

  it('returns 401 UNAUTHORIZED when Authorization header is present but invalid', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const invalid = await request(app)
      .get(`/api/posts/${post.id}`)
      .set('Authorization', 'Bearer invalid-token');

    const malformed = await request(app).get(`/api/posts/${post.id}`).set('Authorization', 'Token abc');

    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('UNAUTHORIZED');

    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 NOT_FOUND when post does not exist', async () => {
    const response = await request(app).get('/api/posts/999999');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Post not found',
      },
    });
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const zero = await request(app).get('/api/posts/0');
    const negative = await request(app).get('/api/posts/-1');
    const nonNumeric = await request(app).get('/api/posts/abc');
    const decimal = await request(app).get('/api/posts/1.5');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(decimal.status).toBe(400);
    expect(decimal.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not require authentication', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app).get(`/api/posts/${post.id}`);

    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
  });
});
