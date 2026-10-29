import { eq } from 'drizzle-orm';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('PUT /api/me/avatar', () => {
  const uploadsDir = path.resolve(process.cwd(), 'uploads-test', 'avatar');
  const previousUploadsDir = process.env.UPLOADS_DIR;
  process.env.UPLOADS_DIR = uploadsDir;
  const app = createApp();

  beforeEach(async () => {
    process.env.UPLOADS_DIR = uploadsDir;
    await rm(uploadsDir, { recursive: true, force: true });
    await mkdir(uploadsDir, { recursive: true });
    await cleanDatabase();
  });

  afterAll(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
    if (previousUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = previousUploadsDir;
    }
    await closeDatabase();
  });

  async function registerUser() {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret1',
    });

    return response.body as { token: string; user: { id: number } };
  }

  async function createImage(): Promise<Buffer> {
    return sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: { r: 220, g: 40, b: 40 },
      },
    })
      .png()
      .toBuffer();
  }

  it('stores the authenticated user avatar as a 200x200 UUID WebP and returns its public URL', async () => {
    const { token, user } = await registerUser();
    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createImage(), 'client-filename.png');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: user.id,
      name: 'Alice',
      email: 'alice@example.com',
      avatarUrl: expect.stringMatching(
        /^\/uploads\/avatars\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/,
      ),
    });

    const stored = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(stored?.avatarPath).toMatch(
      /^avatars\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/,
    );
    expect(path.isAbsolute(stored!.avatarPath!)).toBe(false);

    const imagePath = path.join(uploadsDir, stored!.avatarPath!);
    const metadata = await sharp(await readFile(imagePath)).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(200);

    const publicImage = await request(app).get(response.body.avatarUrl);
    expect(publicImage.status).toBe(200);
    expect(publicImage.headers['content-type']).toMatch(/^image\/webp/);
  });

  it('returns 400 VALIDATION_ERROR when image is missing', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when MIME type is unsupported', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'avatar.gif',
        contentType: 'image/gif',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when file content is not a valid image', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when the image exceeds the upload limit', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for an unexpected multipart field', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', await createImage(), 'avatar.png');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED without a valid token', async () => {
    const response = await request(app).put('/api/me/avatar');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('replaces the previous avatar and removes its file', async () => {
    const { token, user } = await registerUser();
    const first = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createImage(), 'first.png');
    expect(first.status).toBe(200);
    const firstPath = path.join(
      uploadsDir,
      (await db.query.users.findFirst({ where: eq(users.id, user.id) }))!.avatarPath!,
    );

    const second = await request(app)
      .put('/api/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await createImage(), 'second.png');

    expect(second.status).toBe(200);
    expect(second.body.avatarUrl).not.toBe(first.body.avatarUrl);
    await expect(rm(firstPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
