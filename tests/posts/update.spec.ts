import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { posts } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('PUT /api/posts/:id', () => {
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

  async function createPost(token: string, title = 'Original title', content = 'Original content') {
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

  it('updates title and content and returns 200', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '  Updated title  ',
        content: '  Updated content  ',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: post.id,
      title: 'Updated title',
      content: 'Updated content',
      createdAt: post.createdAt,
      imageUrl: null,
      author: {
        id: user.id,
        name: 'Alice',
      },
    });
    expect(response.body.createdAt).toBe(post.createdAt);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });

    expect(stored?.title).toBe('Updated title');
    expect(stored?.content).toBe('Updated content');
  });

  it('does not change createdAt when updating a post', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New title' });

    expect(response.status).toBe(200);
    expect(response.body.createdAt).toBe(post.createdAt);
  });

  it('updates only title when content is omitted', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Only title' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Only title');
    expect(response.body.content).toBe('Original content');
  });

  it('updates only content when title is omitted', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Only content' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Original title');
    expect(response.body.content).toBe('Only content');
  });

  it('returns 400 VALIDATION_ERROR for empty body', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for extra fields', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ok', extra: 'nope' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const nonNumeric = await request(app)
      .put('/api/posts/abc')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ok' });

    const zero = await request(app)
      .put('/api/posts/0')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ok' });

    const negative = await request(app)
      .put('/api/posts/-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ok' });

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when title exceeds 200 characters', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'a'.repeat(201) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when present fields are empty or whitespace', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);

    const emptyTitle = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' });

    const emptyContent = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });

    const whitespaceTitle = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '   ' });

    const whitespaceContent = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' });

    expect(emptyTitle.status).toBe(400);
    expect(emptyTitle.body.error.code).toBe('VALIDATION_ERROR');

    expect(emptyContent.status).toBe(400);
    expect(emptyContent.body.error.code).toBe('VALIDATION_ERROR');

    expect(whitespaceTitle.status).toBe(400);
    expect(whitespaceTitle.body.error.code).toBe('VALIDATION_ERROR');

    expect(whitespaceContent.status).toBe(400);
    expect(whitespaceContent.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when token is missing', async () => {
    const response = await request(app).put('/api/posts/1').send({ title: 'Ok' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when token is invalid', async () => {
    const response = await request(app)
      .put('/api/posts/1')
      .set('Authorization', 'Bearer invalid-token')
      .send({ title: 'Ok' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN when updating another user post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await request(app)
      .put(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Hacked' });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only update your own posts',
    });
  });

  it('returns 404 NOT_FOUND when post does not exist', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/api/posts/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Missing' });

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });
  });
});
