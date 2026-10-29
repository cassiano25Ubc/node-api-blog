import type { UserPublic } from '../../repositories/users.repository.js';
import { toUserProfileDto } from './user-profile.dto.js';

export type AuthResponseDto = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export function toAuthResponseDto(token: string, user: UserPublic): AuthResponseDto {
  return {
    token,
    user: toUserProfileDto(user),
  };
}
