import { AppError } from '../../errors/app-error.js';
import type { UsersRepository } from '../../repositories/users.repository.js';

export class GetMeUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(userId: number) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');

    return user;
  }
}
