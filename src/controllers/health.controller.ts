import type { Request, Response } from 'express';
import { pingsQueue } from '../queues/pings/queue.js';

export async function healthController(_req: Request, res: Response) {
  await pingsQueue.add('pingItem', {at: new Date().toISOString() })
  res.status(200).json({ status: 'ok' });
}
