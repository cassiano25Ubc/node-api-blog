import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { AppError } from '../errors/app-error.js';
import type { ImageStorage } from './image-storage.js';

export class SharpImageStorage implements ImageStorage {
  async saveAvatar(image: Buffer): Promise<string> {
    let normalizedImage: Buffer;

    try {
      normalizedImage = await sharp(image)
        .rotate()
        .resize(200, 200, { fit: 'cover' })
        .webp()
        .toBuffer();
    } catch (error) {
      if (!isInvalidImageError(error)) {
        throw error;
      }

      throw new AppError(400, 'VALIDATION_ERROR', 'Image content is invalid', [
        { path: 'image', message: 'File must contain a valid image' },
      ]);
    }

    const relativePath = `avatars/${randomUUID()}.webp`;
    const absolutePath = this.resolvePath(relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, normalizedImage, { flag: 'wx' });

    return relativePath;
  }

  async remove(relativePath: string): Promise<void> {
    try {
      await unlink(this.resolvePath(relativePath));
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }

      throw error;
    }
  }

  private resolvePath(relativePath: string): string {
    const uploadsDirectory = path.resolve(process.env.UPLOADS_DIR ?? 'uploads');
    const absolutePath = path.resolve(uploadsDirectory, relativePath);
    const pathFromUploads = path.relative(uploadsDirectory, absolutePath);

    if (pathFromUploads.startsWith('..') || path.isAbsolute(pathFromUploads)) {
      throw new Error('Stored image path must remain inside the uploads directory');
    }

    return absolutePath;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isInvalidImageError(error: unknown): error is Error {
  return error instanceof Error && /^(Input buffer|Input image|Vips)/.test(error.message);
}
