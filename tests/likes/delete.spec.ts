import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { likes } from '../../src/db/schema.js';
import { cleanDatabase, closeDatabase } from '../helpers/database.js';

describe('DELETE /api/posts/:id/likes', () => {
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

  async function createPost(token: string) {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Post to unlike',
        content: 'Content',
      });

    return response.body as { id: number };
  }

  async function likePost(token: string, postId: number) {
    await request(app).post(`/api/posts/${postId}/likes`).set('Authorization', `Bearer ${token}`);
  }

  it('unlikes a post and returns 204', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);
    await likePost(bob.token, post.id);

    const response = await request(app)
      .delete(`/api/posts/${post.id}/likes`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const stored = await db.query.likes.findFirst({
      where: and(eq(likes.userId, bob.user.id), eq(likes.postId, post.id)),
    });

    expect(stored).toBeUndefined();
  });

  it('updates likesCount and likedByMe after unliking a post', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);
    await likePost(bob.token, post.id);

    const likedPost = await request(app)
      .get(`/api/posts/${post.id}`)
      .set('Authorization', 'Bearer ' + bob.token);

    expect(likedPost.status).toBe(200);
    expect(likedPost.body.likesCount).toBe(1);
    expect(likedPost.body.likedByMe).toBe(true);

    const unlikeResponse = await request(app)
      .delete(`/api/posts/${post.id}/likes`)
      .set('Authorization', 'Bearer ' + bob.token);

    expect(unlikeResponse.status).toBe(204);

    const unlikedPost = await request(app)
      .get(`/api/posts/${post.id}`)
      .set('Authorization', 'Bearer ' + bob.token);
    const postList = await request(app).get('/api/posts');

    expect(unlikedPost.status).toBe(200);
    expect(unlikedPost.body.likesCount).toBe(0);
    expect(unlikedPost.body.likedByMe).toBe(false);
    expect(postList.status).toBe(200);
    expect(postList.body.data.find((item: { id: number }) => item.id === post.id).likesCount).toBe(0);
  });

  it('allows the author to unlike their own post', async () => {
    const { token, user } = await registerUser('Alice', 'alice@example.com');
    const post = await createPost(token);
    await likePost(token, post.id);

    const response = await request(app)
      .delete(`/api/posts/${post.id}/likes`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const stored = await db.query.likes.findFirst({
      where: and(eq(likes.userId, user.id), eq(likes.postId, post.id)),
    });

    expect(stored).toBeUndefined();
  });

  it('only removes the authenticated user like', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);
    await likePost(alice.token, post.id);
    await likePost(bob.token, post.id);

    const response = await request(app)
      .delete(`/api/posts/${post.id}/likes`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(response.status).toBe(204);

    const bobLike = await db.query.likes.findFirst({
      where: and(eq(likes.userId, bob.user.id), eq(likes.postId, post.id)),
    });
    const aliceLike = await db.query.likes.findFirst({
      where: and(eq(likes.userId, alice.user.id), eq(likes.postId, post.id)),
    });

    expect(bobLike).toBeUndefined();
    expect(aliceLike).toBeDefined();
  });

  it('is idempotent when unliking a post that was not liked', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);

    const response = await request(app)
      .delete(`/api/posts/${post.id}/likes`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const stored = await db.query.likes.findMany({
      where: eq(likes.postId, post.id),
    });

    expect(stored).toHaveLength(0);
  });

  it('is idempotent when unliking the same post twice', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const bob = await registerUser('Bob', 'bob@example.com');
    const post = await createPost(alice.token);
    await likePost(bob.token, post.id);

    const first = await request(app)
      .delete(`/api/posts/${post.id}/likes`)
      .set('Authorization', `Bearer ${bob.token}`);

    const second = await request(app)
      .delete(`/api/posts/${post.id}/likes`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(second.body).toEqual({});

    const stored = await db.query.likes.findMany({
      where: and(eq(likes.userId, bob.user.id), eq(likes.postId, post.id)),
    });

    expect(stored).toHaveLength(0);
  });

  it('returns 400 VALIDATION_ERROR for invalid id', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const nonNumeric = await request(app)
      .delete('/api/posts/abc/likes')
      .set('Authorization', `Bearer ${token}`);

    const zero = await request(app)
      .delete('/api/posts/0/likes')
      .set('Authorization', `Bearer ${token}`);

    const negative = await request(app)
      .delete('/api/posts/-1/likes')
      .set('Authorization', `Bearer ${token}`);

    expect(nonNumeric.status).toBe(400);
    expect(nonNumeric.body.error.code).toBe('VALIDATION_ERROR');

    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    expect(negative.status).toBe(400);
    expect(negative.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHORIZED when token is missing', async () => {
    const response = await request(app).delete('/api/posts/1/likes');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when token is invalid', async () => {
    const response = await request(app)
      .delete('/api/posts/1/likes')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 NOT_FOUND when post does not exist', async () => {
    const { token } = await registerUser('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/api/posts/99999/likes')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Post not found',
    });
  });
});
