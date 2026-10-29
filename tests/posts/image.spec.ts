import { eq } from 'drizzle-orm';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { posts } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('PUT /api/posts/:id/image', () => {
  const uploadsDir = path.resolve(process.cwd(), 'uploads-test', 'post-image');
  const previousUploadsDir = process.env.UPLOADS_DIR;
  process.env.UPLOADS_DIR = uploadsDir;
  const app = createApp();

  beforeEach(async () => {
    process.env.UPLOADS_DIR = uploadsDir;
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

  async function registerUser(name: string, email: string) {
    const response = await request(app).post('/api/auth/register').send({
      name,
      email,
      password: 'secret1',
    });

    return response.body as { token: string; user: { id: number; name: string } };
  }

  async function createPost(token: string) {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Image post', content: 'Post content' });

    return response.body as { id: number };
  }

  async function createImage(width = 1920, height = 1080): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 40, g: 100, b: 220 },
      },
    })
      .png()
      .toBuffer();
  }

  it('stores the owner post image as UUID WebP within 1280x720 and exposes its URL', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', await createImage(), 'client-filename.png');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: post.id,
      title: 'Image post',
      content: 'Post content',
      createdAt: expect.any(String),
      imageUrl: expect.stringMatching(
        /^\/uploads\/posts\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/,
      ),
      author: { id: owner.user.id, name: 'Alice' },
    });

    const stored = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    expect(stored?.imagePath).toMatch(
      /^posts\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/,
    );
    expect(path.isAbsolute(stored!.imagePath!)).toBe(false);

    const imagePath = path.join(uploadsDir, stored!.imagePath!);
    const metadata = await sharp(await readFile(imagePath)).metadata();
    expect(metadata.width).toBe(1280);
    expect(metadata.height).toBe(720);

    const detail = await request(app).get(`/api/posts/${post.id}`);
    expect(detail.body.imageUrl).toBe(response.body.imageUrl);
    const listing = await request(app).get('/api/posts');
    expect(listing.body.data[0].imageUrl).toBe(response.body.imageUrl);
  });

  it('preserves smaller image dimensions without enlarging them', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);

    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', await createImage(640, 480), 'small.png');

    expect(response.status).toBe(200);
    const stored = await db.query.posts.findFirst({ where: eq(posts.id, post.id) });
    const metadata = await sharp(await readFile(path.join(uploadsDir, stored!.imagePath!))).metadata();
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(480);
  });

  it('returns 400 VALIDATION_ERROR when image is missing', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);
    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when MIME type is unsupported', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);
    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'image.gif',
        contentType: 'image/gif',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when file content is not a valid image', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);
    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'image.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when image exceeds 5 MiB', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);
    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for an unexpected multipart field', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);
    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', await createImage(64, 64), 'image.png');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when the post id is invalid', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const response = await request(app)
      .put('/api/posts/not-a-number/image')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', await createImage(64, 64), 'image.png');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED without a valid token', async () => {
    const response = await request(app).put('/api/posts/1/image');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN when another user updates the post image', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const other = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(owner.token);
    const response = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${other.token}`)
      .attach('image', await createImage(64, 64), 'image.png');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 NOT_FOUND when the post does not exist', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const response = await request(app)
      .put('/api/posts/99999/image')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', await createImage(64, 64), 'image.png');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('replaces the post image and removes the old file', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);
    const first = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', await createImage(64, 64), 'first.png');
    expect(first.status).toBe(200);
    const firstPath = path.join(
      uploadsDir,
      (await db.query.posts.findFirst({ where: eq(posts.id, post.id) }))!.imagePath!,
    );

    const second = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', await createImage(80, 80), 'second.png');

    expect(second.status).toBe(200);
    expect(second.body.imageUrl).not.toBe(first.body.imageUrl);
    await expect(rm(firstPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('removes the image file when deleting its post', async () => {
    const owner = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(owner.token);
    const upload = await request(app)
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', await createImage(64, 64), 'image.png');
    const stored = await db.query.posts.findFirst({ where: eq(posts.id, post.id) });
    const imagePath = path.join(uploadsDir, stored!.imagePath!);

    const deleted = await request(app)
      .delete(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(upload.status).toBe(200);
    expect(deleted.status).toBe(204);
    await expect(rm(imagePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
