import multer from 'multer';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/app-error.js';

const maximumImageSize = 5 * 1024 * 1024;
const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumImageSize },
  fileFilter(_req, file, callback) {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, 'VALIDATION_ERROR', 'Unsupported image type', [
        { path: 'image', message: 'File must be JPEG, PNG, or WebP' },
      ]));
      return;
    }

    callback(null, true);
  },
});

export function singleImageUpload(fieldName: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          new AppError(400, 'VALIDATION_ERROR', 'Invalid image upload', [
            { path: 'image', message: error.code === 'LIMIT_FILE_SIZE'
              ? 'File exceeds the 5 MB limit'
              : 'Unexpected or invalid image field' },
          ]),
        );
        return;
      }

      next(error);
    });
  };
}
