import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('POST /api/auth/login', () => {
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
      email: 'Alice@Example.com',
      password: 'secret1',
    });

    return response.body as { token: string; user: { id: number; name: string; email: string } };
  }

  it('logs in and returns 200 with a new token and user', async () => {
    const registered = await registerUser();

    const response = await request(app).post('/api/auth/login').send({
      email: 'Alice@Example.com',
      password: 'secret1',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: expect.any(String),
      user: {
        id: registered.user.id,
        name: 'Alice',
        email: 'alice@example.com',
        avatarUrl: null,
      },
    });
    expect(response.body.token.length).toBeGreaterThan(0);
    expect(response.body.token).not.toBe(registered.token);
    expect(response.body).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('password');

    const stored = await db.query.users.findFirst({
      where: eq(users.email, 'alice@example.com'),
    });

    expect(stored?.token).toBe(response.body.token);
  });

  it('invalidates the previous session token after login', async () => {
    const registered = await registerUser();

    const login = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'secret1',
    });

    expect(login.status).toBe(200);

    const withOldToken = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${registered.token}`)
      .send({ title: 'Hello', content: 'World' });

    const withNewToken = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ title: 'Hello', content: 'World' });

    expect(withOldToken.status).toBe(401);
    expect(withOldToken.body.error.code).toBe('UNAUTHORIZED');
    expect(withNewToken.status).toBe(201);
  });

  it('returns 400 VALIDATION_ERROR for invalid body', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'not-an-email',
      password: '123',
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

  it('returns 400 VALIDATION_ERROR when required fields are missing', async () => {
    const empty = await request(app).post('/api/auth/login').send({});
    const missingPassword = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
    });

    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    expect(missingPassword.status).toBe(400);
    expect(missingPassword.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED for unknown email', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'missing@example.com',
      password: 'secret1',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED for wrong password', async () => {
    await registerUser();

    const response = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'wrongpassword',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
