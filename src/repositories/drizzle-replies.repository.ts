import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { replies, users } from '../db/schema.js';
import type {
  CreateReplyData,
  RepliesRepository,
  ReplyRecord,
  ReplyWithAuthorRow,
  ReplyWithPostAndAuthorRow,
} from './replies.repository.js';

export class DrizzleRepliesRepository implements RepliesRepository {
  async create(data: CreateReplyData): Promise<Omit<ReplyRecord, 'authorId' | 'postId'>> {
    const [reply] = await db
      .insert(replies)
      .values({
        content: data.content,
        authorId: data.authorId,
        postId: data.postId,
      })
      .returning({
        id: replies.id,
        content: replies.content,
        createdAt: replies.createdAt,
      });

    return reply;
  }

  async findById(replyId: number): Promise<ReplyRecord | null> {
    const existing = await db.query.replies.findFirst({
      where: eq(replies.id, replyId),
    });

    return existing ?? null;
  }

  async listByPostId(postId: number): Promise<ReplyWithAuthorRow[]> {
    return db
      .select({
        id: replies.id,
        content: replies.content,
        createdAt: replies.createdAt,
        authorId: users.id,
        authorName: users.name,
      })
      .from(replies)
      .innerJoin(users, eq(replies.authorId, users.id))
      .where(eq(replies.postId, postId))
      .orderBy(asc(replies.createdAt));
  }

  async listByPostIds(postIds: number[]): Promise<ReplyWithPostAndAuthorRow[]> {
    if (postIds.length === 0) {
      return [];
    }

    return db
      .select({
        id: replies.id,
        content: replies.content,
        createdAt: replies.createdAt,
        authorId: users.id,
        authorName: users.name,
        postId: replies.postId,
      })
      .from(replies)
      .innerJoin(users, eq(replies.authorId, users.id))
      .where(inArray(replies.postId, postIds))
      .orderBy(asc(replies.createdAt));
  }

  async delete(replyId: number): Promise<void> {
    await db.delete(replies).where(eq(replies.id, replyId));
  }
}
