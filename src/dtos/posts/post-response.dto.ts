import { toReplyResponseDto, type ReplyResponseDto } from '../replies/reply-response.dto.js';

type PostLike = {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
};

type ReplyWithAuthorLike = {
  id: number;
  content: string;
  createdAt: Date;
  authorId: number;
  authorName: string;
};

type AuthorLike = {
  id: number;
  name: string;
};

type PostWithAuthorLike = PostLike & {
  authorId: number;
  authorName: string;
};

export type PostResponseDto = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
  };
};

export type PostListItemDto = PostResponseDto & {
  likesCount: number;
  replies: ReplyResponseDto[];
};

export type PostDetailDto = PostResponseDto & {
  likesCount: number;
  likedByMe: boolean;
  replies: ReplyResponseDto[];
};

export type ListPostsResponseDto = {
  data: PostListItemDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function toPostResponseDto(post: PostLike, author: AuthorLike): PostResponseDto {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: { id: author.id, name: author.name },
  };
}

export function toPostDetailDto(
  post: PostLike & { likesCount: number; likedByMe: boolean; replies: ReplyWithAuthorLike[] },
  author: AuthorLike,
): PostDetailDto {
  return {
    ...toPostResponseDto(post, author),
    likesCount: post.likesCount,
    likedByMe: post.likedByMe,
    replies: post.replies.map((reply) =>
      toReplyResponseDto(reply, { id: reply.authorId, name: reply.authorName }),
    ),
  };
}

export function toListPostsResponseDto(
  rows: (PostWithAuthorLike & { likesCount: number; replies: ReplyWithAuthorLike[] })[],
  meta: { page: number; limit: number; total: number },
): ListPostsResponseDto {
  return {
    data: rows.map((row) => ({
      ...toPostResponseDto(row, { id: row.authorId, name: row.authorName }),
      likesCount: row.likesCount,
      replies: row.replies.map((reply) =>
        toReplyResponseDto(reply, { id: reply.authorId, name: reply.authorName }),
      ),
    })),
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  };
}
