import 'dotenv/config';
import { createApp } from './app.js';
import { pingsQueue } from './queues/pings/queue.js'
import { startPingWorker } from './queues/pings/worker.js';

const port = Number(process.env.PORT) || 3000;
const app = createApp();

startPingWorker()

await pingsQueue.add('pingItem', {at: new Date().toISOString() })

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
