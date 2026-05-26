import { Worker, type Job } from "bullmq"
import { redisConnection }  from "../setup"
import { runPipeline }      from "../../pipeline"
import { createClient }     from "../../lib/supabase"
import { notifyLineAfterExtraction } from "../../routes/line"

export interface ExtractionJobData {
  documentId: string
  orgId:      string   // matches queueExtraction payload key
  /** @deprecated use orgId */
  organizationId?: string
}

export function startExtractionWorker() {
  const worker = new Worker<ExtractionJobData>(
    "extraction",
    async (job: Job<ExtractionJobData>) => {
      const { documentId } = job.data
      // Support both key names for backwards-compatibility
      const orgId = job.data.orgId ?? job.data.organizationId ?? ""
      console.log(`[extraction] Processing document ${documentId}`)

      const result = await runPipeline(documentId, orgId)

      if (!result.success) {
        throw new Error(result.error ?? "Pipeline failed")
      }

      console.log(
        `[extraction] Done ${documentId} — score=${result.confidence_score.toFixed(2)} auto_approved=${result.auto_approved}`
      )

      return result
    },
    {
      connection:  redisConnection,
      concurrency: 3,
    }
  )

  worker.on("failed", async (job, err) => {
    if (!job) return
    console.error(`[extraction] Job ${job.id} failed:`, err.message)

    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const supabase = createClient()
      await supabase
        .from("documents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", job.data.documentId)

      const orgId = job.data.orgId ?? job.data.organizationId ?? ""
      await notifyLineAfterExtraction(
        job.data.documentId,
        orgId,
        { success: false, error: err.message }
      ).catch(() => {})
    }
  })

  worker.on("completed", async (job, result) => {
    console.log(`[extraction] Job ${job.id} completed`)

    const orgId = job.data.orgId ?? job.data.organizationId ?? ""
    await notifyLineAfterExtraction(
      job.data.documentId,
      orgId,
      result
    ).catch(() => {})
  })

  console.log("[extraction] Worker started")
  return worker
}
