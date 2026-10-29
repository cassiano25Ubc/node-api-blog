import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('GET /api/me', () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  async function registerUser() {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'secret1' });

    return response.body as { token: string; user: { id: number } };
  }

  it('returns the authenticated user with a null avatarUrl', async () => {
    const { token, user } = await registerUser();

    const response = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: user.id,
      name: 'Alice',
      email: 'alice@example.com',
      avatarUrl: null,
    });
  });

  it('never exposes password or token', async () => {
    const { token } = await registerUser();

    const response = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);

    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('token');
  });

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with an unknown token', async () => {
    const response = await request(app).get('/api/me').set('Authorization', 'Bearer nope');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
