import { AppError } from '../../errors/app-error.js';
import type { PostRecord, PostsRepository } from '../../repositories/posts.repository.js';
import type { NewReplyEmailJobsRepository } from '../../repositories/new-reply-email-jobs.repository.js';
import type { RepliesRepository } from '../../repositories/replies.repository.js';
import type { UsersRepository } from '../../repositories/users.repository.js';
import type { CreateReplyBody } from '../../schemas/replies.schemas.js';
import type { AuthUser } from '../../types/auth.js';

type CreateReplyInput = {
  author: AuthUser;
  postId: number;
  data: CreateReplyBody;
};

export class CreateReplyUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly repliesRepository: RepliesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly emailJobs: NewReplyEmailJobsRepository,
  ) {}

  async execute({ author, postId, data }: CreateReplyInput) {
    const existing = await this.postsRepository.findById(postId);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Post not found');

    const reply = await this.repliesRepository.create({
      content: data.content,
      authorId: author.id,
      postId,
    });

    if (existing.authorId !== author.id) {
      await this.notifyPostAuthor(existing, author, data.content);
    }

    return reply;
  }

  private async notifyPostAuthor(post: PostRecord, replyAuthor: AuthUser, content: string) {
    try {
      const postAuthor = await this.usersRepository.findById(post.authorId);
      if (!postAuthor) return;

      await this.emailJobs.enqueue({
        to: postAuthor.email,
        postAuthorName: postAuthor.name,
        postTitle: post.title,
        replyAuthorName: replyAuthor.name,
        replyContent: content,
      });
    } catch (error) {
      console.error('Failed to enqueue reply notification e-mail', error);
    }
  }
}
