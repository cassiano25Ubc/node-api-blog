import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('POST /api/auth/register', () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('registers a user and returns 201 with token and user', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'Alice@Example.com',
      password: 'secret1',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      token: expect.any(String),
      user: {
        id: expect.any(Number),
        name: 'Alice',
        email: 'alice@example.com',
        avatarUrl: null,
      },
    });
    expect(response.body.token.length).toBeGreaterThan(0);
    expect(response.body).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('password');

    const stored = await db.query.users.findFirst({
      where: eq(users.email, 'alice@example.com'),
    });

    expect(stored).toBeDefined();
    expect(stored?.token).toBe(response.body.token);
    expect(stored?.password).not.toBe('secret1');
    expect(stored?.password.startsWith('$2')).toBe(true);
  });

  it('trims name before persisting', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: '  Alice  ',
      email: 'alice@example.com',
      password: 'secret1',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.name).toBe('Alice');
  });

  it('accepts password with exactly 6 characters', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: '123456',
    });

    expect(response.status).toBe(201);
  });

  it('returns 400 VALIDATION_ERROR for invalid body', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: '',
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

  it('returns 400 VALIDATION_ERROR when name exceeds 100 characters', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'a'.repeat(101),
      email: 'alice@example.com',
      password: 'secret1',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when name is only whitespace', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: '   ',
      email: 'alice@example.com',
      password: 'secret1',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when password has fewer than 6 characters', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: '12345',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when required fields are missing', async () => {
    const empty = await request(app).post('/api/auth/register').send({});
    const partial = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
    });

    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    expect(partial.status).toBe(400);
    expect(partial.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 CONFLICT when email is already registered', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret1',
    });

    const response = await request(app).post('/api/auth/register').send({
      name: 'Alice 2',
      email: 'alice@example.com',
      password: 'secret2',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('returns 409 CONFLICT when email differs only by case', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret1',
    });

    const response = await request(app).post('/api/auth/register').send({
      name: 'Alice 2',
      email: 'ALICE@example.com',
      password: 'secret2',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
