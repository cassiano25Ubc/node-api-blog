import type { ImageStorage } from '../../storage/image-storage.js';
import type {
  AvatarUpdateResult,
  UserPublic,
  UsersRepository,
} from '../../repositories/users.repository.js';

type UpdateAvatarInput = {
  userId: number;
  image: Buffer;
};

export class UpdateAvatarUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute({ userId, image }: UpdateAvatarInput): Promise<UserPublic> {
    const avatarPath = await this.imageStorage.saveAvatar(image);
    let result: AvatarUpdateResult;

    try {
      result = await this.usersRepository.updateAvatarPath(userId, avatarPath);
    } catch (error) {
      await this.removeOrphanedImage(avatarPath);
      throw error;
    }

    if (result.previousAvatarPath) {
      try {
        await this.imageStorage.remove(result.previousAvatarPath);
      } catch (error) {
        console.error('Failed to remove replaced avatar image', error);
      }
    }

    return result.user;
  }

  private async removeOrphanedImage(avatarPath: string): Promise<void> {
    try {
      await this.imageStorage.remove(avatarPath);
    } catch (error) {
      console.error('Failed to remove orphaned avatar image', error);
    }
  }
}
