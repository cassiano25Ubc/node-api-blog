import express from 'express';
import path from 'node:path';
import { errorHandler } from './middlewares/error-handler.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { meRouter } from './routes/me.routes.js';
import { postsRouter } from './routes/posts.routes.js';

export function createApp() {
  const app = express();

  app.use(
    '/uploads',
    express.static(path.resolve(process.env.UPLOADS_DIR ?? 'uploads')),
  );
  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  app.use(meRouter);
  app.use(postsRouter);
  app.use(errorHandler);

  return app;
}
