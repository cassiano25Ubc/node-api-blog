import type { UserPublic } from '../../repositories/users.repository.js';
import { toPublicImageUrl } from '../../storage/public-image-url.js';

export function toUserProfileDto(user: UserPublic) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: toPublicImageUrl(user.avatarPath),
  };
}
