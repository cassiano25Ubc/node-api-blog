import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type {
  CreateUserData,
  AvatarUpdateResult,
  UserPublic,
  UserRecord,
  UsersRepository,
} from './users.repository.js';

export class DrizzleUsersRepository implements UsersRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    return user ?? null;
  }

  async create(data: CreateUserData): Promise<UserPublic> {
    const [user] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        password: data.password,
        token: data.token,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarPath: users.avatarPath,
      });

    return user;
  }

  async updateToken(userId: number, token: string): Promise<void> {
    await db.update(users).set({ token }).where(eq(users.id, userId));
  }

  async updateAvatarPath(userId: number, avatarPath: string): Promise<AvatarUpdateResult> {
    return db.transaction(async (transaction) => {
      const [current] = await transaction
        .select({ avatarPath: users.avatarPath })
        .from(users)
        .where(eq(users.id, userId))
        .for('update');

      if (!current) {
        throw new Error(`Authenticated user ${userId} was not found`);
      }

      const [user] = await transaction
        .update(users)
        .set({ avatarPath })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarPath: users.avatarPath,
        });

      if (!user) {
        throw new Error(`Failed to update avatar for user ${userId}`);
      }

      return { user, previousAvatarPath: current.avatarPath };
    });
  }
}
