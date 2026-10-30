import 'dotenv/config';
import { createApp } from './app.js';
import { startReplyNotificationWorker } from './queues/reply-notification/worker.js';
import { startPingWorker } from './queues/pings/worker.js';

const port = Number(process.env.PORT) || 3000;
const app = createApp();

startPingWorker()
startReplyNotificationWorker()


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
