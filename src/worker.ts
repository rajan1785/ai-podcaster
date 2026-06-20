import { Worker } from "bullmq";
import { MEDIA_QUEUE, redisConnection } from "@/services/queue";
import { processMediaJob } from "@/services/processor";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.log("REDIS_URL is not set; the web process will use its local worker fallback.");
  setInterval(() => undefined, 60_000);
} else {
  const connection = redisConnection()!;
  const worker = new Worker(
    MEDIA_QUEUE,
    async (job) => processMediaJob(job.data.jobId as string),
    { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 1) },
  );

  worker.on("completed", (job) => console.log(`Completed media job ${job.id}`));
  worker.on("failed", (job, error) => console.error(`Failed media job ${job?.id}`, error));

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
