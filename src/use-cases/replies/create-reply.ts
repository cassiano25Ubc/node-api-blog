import { AppError } from '../../errors/app-error.js';
import type { Mailer } from '../../mail/mailer.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
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
    _usersRepository: UsersRepository,
    _mailer: Mailer,
  ) {}

  async execute({ author, postId, data }: CreateReplyInput) {
    const existing = await this.postsRepository.findById(postId);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Post not found');

    const reply = await this.repliesRepository.create({
      content: data.content,
      authorId: author.id,
      postId,
    });

    return reply;
  }
}
