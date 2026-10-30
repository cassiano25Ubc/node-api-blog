import { Job } from "bullmq";
export async function processPing(job: Job) {
    console.log('pong', job.id, job.data)
}