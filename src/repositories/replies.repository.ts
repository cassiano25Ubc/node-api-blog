export type ReplyRecord = {
  id: number;
  content: string;
  createdAt: Date;
  authorId: number;
  postId: number;
};

export type CreateReplyData = {
  content: string;
  authorId: number;
  postId: number;
};

export type ReplyWithAuthorRow = {
  id: number;
  content: string;
  createdAt: Date;
  authorId: number;
  authorName: string;
};

export type ReplyWithPostAndAuthorRow = ReplyWithAuthorRow & {
  postId: number;
};

export interface RepliesRepository {
  create(data: CreateReplyData): Promise<Omit<ReplyRecord, 'authorId' | 'postId'>>;
  findById(replyId: number): Promise<ReplyRecord | null>;
  listByPostId(postId: number): Promise<ReplyWithAuthorRow[]>;
  listByPostIds(postIds: number[]): Promise<ReplyWithPostAndAuthorRow[]>;
  delete(replyId: number): Promise<void>;
}
