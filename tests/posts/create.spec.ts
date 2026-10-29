import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { posts } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('POST /api/posts', () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  async function registerUser() {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret1',
    });

    return response.body as { token: string; user: { id: number; name: string; email: string } };
  }

  it('creates a post and returns 201 with post and author', async () => {
    const { token, user } = await registerUser();

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '  Hello World  ',
        content: '  First post content  ',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      title: 'Hello World',
      content: 'First post content',
      createdAt: expect.any(String),
      imageUrl: null,
      author: {
        id: user.id,
        name: 'Alice',
      },
    });
    expect(Number.isNaN(Date.parse(response.body.createdAt))).toBe(false);
    expect(response.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, response.body.id),
    });

    expect(stored).toBeDefined();
    expect(stored?.title).toBe('Hello World');
    expect(stored?.content).toBe('First post content');
    expect(stored?.authorId).toBe(user.id);
  });

  it('returns 400 VALIDATION_ERROR for invalid body', async () => {
    const { token } = await registerUser();

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '',
        content: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.any(String),
          message: expect.any(String),
        }),
      ]),
    );
  });

  it('returns 400 VALIDATION_ERROR when title exceeds 200 characters', async () => {
    const { token } = await registerUser();

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'a'.repeat(201),
        content: 'Valid content',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when title or content is only whitespace', async () => {
    const { token } = await registerUser();

    const whitespaceTitle = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '   ', content: 'Valid content' });

    const whitespaceContent = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Valid title', content: '   ' });

    expect(whitespaceTitle.status).toBe(400);
    expect(whitespaceTitle.body.error.code).toBe('VALIDATION_ERROR');

    expect(whitespaceContent.status).toBe(400);
    expect(whitespaceContent.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when required fields are missing', async () => {
    const { token } = await registerUser();

    const missingContent = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Only title' });

    const missingTitle = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Only content' });

    expect(missingContent.status).toBe(400);
    expect(missingContent.body.error.code).toBe('VALIDATION_ERROR');

    expect(missingTitle.status).toBe(400);
    expect(missingTitle.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when token is missing', async () => {
    const response = await request(app).post('/api/posts').send({
      title: 'Hello',
      content: 'World',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when token is invalid', async () => {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        title: 'Hello',
        content: 'World',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED for malformed Authorization header', async () => {
    const rawToken = await request(app)
      .post('/api/posts')
      .set('Authorization', 'not-a-bearer-token')
      .send({ title: 'Hello', content: 'World' });

    const basicScheme = await request(app)
      .post('/api/posts')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .send({ title: 'Hello', content: 'World' });

    const emptyBearer = await request(app)
      .post('/api/posts')
      .set('Authorization', 'Bearer ')
      .send({ title: 'Hello', content: 'World' });

    const whitespaceBearer = await request(app)
      .post('/api/posts')
      .set('Authorization', 'Bearer    ')
      .send({ title: 'Hello', content: 'World' });

    expect(rawToken.status).toBe(401);
    expect(rawToken.body.error.code).toBe('UNAUTHORIZED');

    expect(basicScheme.status).toBe(401);
    expect(basicScheme.body.error.code).toBe('UNAUTHORIZED');

    expect(emptyBearer.status).toBe(401);
    expect(emptyBearer.body.error.code).toBe('UNAUTHORIZED');

    expect(whitespaceBearer.status).toBe(401);
    expect(whitespaceBearer.body.error.code).toBe('UNAUTHORIZED');
  });
});
