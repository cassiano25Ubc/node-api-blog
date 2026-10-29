import { Router } from 'express';
import { getMeController, updateAvatarController } from '../controllers/me.controller.js';
import { singleImageUpload } from '../middlewares/image-upload.js';
import { requireAuth } from '../middlewares/auth.js';

export const meRouter = Router();

meRouter.get('/api/me', requireAuth, getMeController);
meRouter.put('/api/me/avatar', requireAuth, singleImageUpload('image'), updateAvatarController);
