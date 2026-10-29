import type { Request, Response } from 'express';
import { toListPostsResponseDto, toPostDetailDto, toPostResponseDto } from '../dtos/posts/post-response.dto.js';
import { DrizzleLikesRepository } from '../repositories/drizzle-likes.repository.js';
import { DrizzlePostsRepository } from '../repositories/drizzle-posts.repository.js';
import { DrizzleRepliesRepository } from '../repositories/drizzle-replies.repository.js';
import { AppError } from '../errors/app-error.js';
import { SharpImageStorage } from '../storage/sharp-image-storage.js';
import {
  createPostBodySchema,
  listPostsQuerySchema,
  postIdParamsSchema,
  updatePostBodySchema,
} from '../schemas/posts.schemas.js';
import { validate } from '../utils/validate.js';
import { CreatePostUseCase } from '../use-cases/posts/create-post.js';
import { DeletePostUseCase } from '../use-cases/posts/delete-post.js';
import { GetPostUseCase } from '../use-cases/posts/get-post.js';
import { ListPostsUseCase } from '../use-cases/posts/list-posts.js';
import { UpdatePostUseCase } from '../use-cases/posts/update-post.js';
import { UpdatePostImageUseCase } from '../use-cases/posts/update-post-image.js';

const postsRepository = new DrizzlePostsRepository();
const likesRepository = new DrizzleLikesRepository();
const repliesRepository = new DrizzleRepliesRepository();
const imageStorage = new SharpImageStorage();

const listPosts = new ListPostsUseCase(postsRepository, likesRepository, repliesRepository);
const getPost = new GetPostUseCase(postsRepository, likesRepository, repliesRepository);
const createPost = new CreatePostUseCase(postsRepository);
const updatePost = new UpdatePostUseCase(postsRepository);
const deletePost = new DeletePostUseCase(postsRepository, imageStorage);
const updatePostImage = new UpdatePostImageUseCase(postsRepository, imageStorage);

export async function listPostsController(req: Request, res: Response): Promise<void> {
  const query = validate(listPostsQuerySchema, req.query);
  const { rows, total, page, limit } = await listPosts.execute({ page: query.page });

  res.status(200).json(toListPostsResponseDto(rows, { page, limit, total }));
}

export async function getPostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  const post = await getPost.execute({ postId: params.id, userId: req.user?.id });

  res.status(200).json(toPostDetailDto(post, { id: post.authorId, name: post.authorName }));
}

export async function createPostController(req: Request, res: Response): Promise<void> {
  const body = validate(createPostBodySchema, req.body);
  const post = await createPost.execute({ author: req.user!, data: body });

  res.status(201).json(toPostResponseDto(post, req.user!));
}

export async function updatePostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  const body = validate(updatePostBodySchema, req.body);
  const post = await updatePost.execute({ author: req.user!, postId: params.id, data: body });

  res.status(200).json(toPostResponseDto(post, req.user!));
}

export async function updatePostImageController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);

  if (!req.file) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Image file is required', [
      { path: 'image', message: 'Image file is required' },
    ]);
  }

  const post = await updatePostImage.execute({
    author: req.user!,
    postId: params.id,
    image: req.file.buffer,
  });

  res.status(200).json(toPostResponseDto(post, req.user!));
}

export async function deletePostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  await deletePost.execute({ author: req.user!, postId: params.id });

  res.status(204).send();
}
