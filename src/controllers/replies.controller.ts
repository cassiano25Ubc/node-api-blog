import type { Request, Response } from 'express';
import { toReplyResponseDto } from '../dtos/replies/reply-response.dto.js';
import { NodemailerMailer } from '../mail/nodemailer-mailer.js';
import { DrizzleUsersRepository } from '../repositories/drizzle-users.repository.js';
import { DrizzlePostsRepository } from '../repositories/drizzle-posts.repository.js';
import { DrizzleRepliesRepository } from '../repositories/drizzle-replies.repository.js';
import {
  createReplyBodySchema,
  createReplyParamsSchema,
  deleteReplyParamsSchema,
} from '../schemas/replies.schemas.js';
import { CreateReplyUseCase } from '../use-cases/replies/create-reply.js';
import { DeleteReplyUseCase } from '../use-cases/replies/delete-reply.js';
import { validate } from '../utils/validate.js';

const postsRepository = new DrizzlePostsRepository();
const repliesRepository = new DrizzleRepliesRepository();

const usersRepository = new DrizzleUsersRepository();
const mailer = new NodemailerMailer();

const createReply = new CreateReplyUseCase(
  postsRepository,
  repliesRepository,
  usersRepository,
  mailer,
);
const deleteReply = new DeleteReplyUseCase(postsRepository, repliesRepository);

export async function createReplyController(req: Request, res: Response): Promise<void> {
  const params = validate(createReplyParamsSchema, req.params);
  const body = validate(createReplyBodySchema, req.body);
  const reply = await createReply.execute({ author: req.user!, postId: params.id, data: body });

  res.status(201).json(toReplyResponseDto(reply, req.user!));
}

export async function deleteReplyController(req: Request, res: Response): Promise<void> {
  const params = validate(deleteReplyParamsSchema, req.params);
  await deleteReply.execute({ author: req.user!, postId: params.id, replyId: params.replyId });

  res.status(204).send();
}
