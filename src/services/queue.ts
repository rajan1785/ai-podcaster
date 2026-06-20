import { Queue, type ConnectionOptions } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { saveJob } from "@/lib/job-store";
import type { MediaJob } from "@/lib/types";
import { processMediaJob } from "@/services/processor";

export const MEDIA_QUEUE = "media-analysis";
let queue: Queue | undefined;

export function redisConnection(): ConnectionOptions | undefined {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

function getQueue() {
  if (queue) return queue;
  const connection = redisConnection();
  if (!connection) return undefined;
  queue = new Queue(MEDIA_QUEUE, { connection });
  return queue;
}

export async function createJob(
  fileName: string,
  filePath: string,
  mimeType: string,
) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const job: MediaJob = {
    id,
    status: "pending",
    stage: "queued",
    stageLabel: "Waiting for a worker",
    progress: 0,
    fileName,
    filePath,
    mimeType,
    createdAt: now,
    updatedAt: now,
  };
  await saveJob(job);

  const bullQueue = getQueue();
  if (bullQueue) {
    await bullQueue.add("analyze", { jobId: id }, {
      jobId: id,
      attempts: 2,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  } else {
    setImmediate(() => {
      void processMediaJob(id).catch((error) => console.error("Local worker failed", error));
    });
  }

  return id;
}
