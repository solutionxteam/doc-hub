import { Queue, Worker, QueueEvents } from "bullmq"
import { Redis } from "ioredis"
import "dotenv/config"

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
})

export const extractionQueue = new Queue("extraction", { connection })
export const pushQueue       = new Queue("push",       { connection })
export const syncQueue       = new Queue("sync",       { connection })

export { connection as redisConnection }

export async function queueExtraction(payload: {
  documentId: string
  filePath:   string
  fileType:   string
  orgId:      string
}) {
  await extractionQueue.add("extract", payload, {
    jobId:            `extract-${payload.documentId}`,
    priority:         1,
    removeOnComplete: { age: 86400 },
    removeOnFail:     { age: 7 * 86400 },
  })
}

export async function queuePush(payload: {
  documentId:    string
  integrationId: string
}) {
  await pushQueue.add("push", payload, {
    jobId:    `push-${payload.documentId}-${payload.integrationId}`,
    attempts: 3,
    backoff:  { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 86400 },
    removeOnFail:     { age: 7 * 86400 },
  })
}
