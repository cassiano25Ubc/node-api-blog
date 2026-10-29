import { AppError } from '../../errors/app-error.js';
import type {
  PostImageUpdateResult,
  PostsRepository,
} from '../../repositories/posts.repository.js';
import type { ImageStorage } from '../../storage/image-storage.js';
import type { AuthUser } from '../../types/auth.js';

type UpdatePostImageInput = {
  author: AuthUser;
  postId: number;
  image: Buffer;
};

export class UpdatePostImageUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute({ author, postId, image }: UpdatePostImageInput) {
    const existing = await this.postsRepository.findById(postId);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    }

    if (existing.authorId !== author.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only update your own posts');
    }

    const imagePath = await this.imageStorage.savePostImage(image);
    let result: PostImageUpdateResult | null;

    try {
      result = await this.postsRepository.updateImagePath(postId, imagePath);
    } catch (error) {
      await this.removeOrphanedImage(imagePath);
      throw error;
    }

    if (!result) {
      await this.removeOrphanedImage(imagePath);
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    }

    if (result.previousImagePath) {
      try {
        await this.imageStorage.remove(result.previousImagePath);
      } catch (error) {
        console.error('Failed to remove replaced post image', error);
      }
    }

    return result.post;
  }

  private async removeOrphanedImage(imagePath: string): Promise<void> {
    try {
      await this.imageStorage.remove(imagePath);
    } catch (error) {
      console.error('Failed to remove orphaned post image', error);
    }
  }
}
