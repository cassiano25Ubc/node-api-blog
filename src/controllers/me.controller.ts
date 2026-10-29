import type { Request, Response } from 'express';
import { toUserProfileDto } from '../dtos/auth/user-profile.dto.js';
import { AppError } from '../errors/app-error.js';
import { DrizzleUsersRepository } from '../repositories/drizzle-users.repository.js';
import { SharpImageStorage } from '../storage/sharp-image-storage.js';
import { UpdateAvatarUseCase } from '../use-cases/auth/update-avatar.js';

const updateAvatar = new UpdateAvatarUseCase(
  new DrizzleUsersRepository(),
  new SharpImageStorage(),
);

export async function updateAvatarController(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Image file is required', [
      { path: 'image', message: 'Image file is required' },
    ]);
  }

  const user = await updateAvatar.execute({
    userId: req.user!.id,
    image: req.file.buffer,
  });

  res.status(200).json(toUserProfileDto(user));
}
