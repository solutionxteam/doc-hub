import { Worker, type Job } from "bullmq"
import { redisConnection }  from "../setup"
import { runPipeline }      from "../../pipeline"
import { createClient }     from "../../lib/supabase"
import { notifyLineAfterExtraction } from "../../routes/line"

export interface ExtractionJobData {
  documentId:  string
  orgId:       string
  lineUserId?: string   // passed from LINE webhook so we skip a DB round-trip
  /** @deprecated use orgId */
  organizationId?: string
}

export function startExtractionWorker() {
  const worker = new Worker<ExtractionJobData>(
    "extraction",
    async (job: Job<ExtractionJobData>) => {
      const { documentId } = job.data
      const orgId = job.data.orgId ?? job.data.organizationId ?? ""
      console.log(`[extraction] ▶ Processing ${documentId}  org=${orgId}`)

      const result = await runPipeline(documentId, orgId)

      if (!result.success) {
        throw new Error(result.error ?? "Pipeline failed")
      }

      console.log(
        `[extraction] ✅ Done ${documentId} — score=${result.confidence_score.toFixed(2)} auto_approved=${result.auto_approved}`
      )
      return result
    },
    { connection: redisConnection, concurrency: 3 }
  )

  // ── Job completed — notify LINE user ────────────────────────────────────────
  worker.on("completed", async (job, result) => {
    const { documentId, lineUserId } = job.data
    const orgId = job.data.orgId ?? job.data.organizationId ?? ""
    console.log(`[extraction] 📤 Notifying LINE for ${documentId}  lineUserId=${lineUserId ?? "unknown"}`)

    try {
      await notifyLineAfterExtraction(documentId, orgId, result, lineUserId)
      console.log(`[extraction] 📬 LINE notification sent for ${documentId}`)
    } catch (err: any) {
      // Log clearly — never rethrow (notification failure ≠ job failure)
      console.error(`[extraction] ❌ LINE notification failed for ${documentId}:`, err.message)
    }
  })

  // ── Job permanently failed — notify LINE user of failure ────────────────────
  worker.on("failed", async (job, err) => {
    if (!job) return
    const { documentId, lineUserId } = job.data
    console.error(`[extraction] ❌ Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message)

    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const supabase = createClient()
      supabase
        .from("documents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", documentId)
        .then(({ error }) => { if (error) console.error("[extraction] DB status update failed:", error.message) })

      const orgId = job.data.orgId ?? job.data.organizationId ?? ""
      try {
        await notifyLineAfterExtraction(
          documentId, orgId,
          { success: false, error: err.message },
          lineUserId
        )
      } catch (ne: any) {
        console.error(`[extraction] ❌ Failure notification failed for ${documentId}:`, ne.message)
      }
    }
  })

  console.log("[extraction] Worker started ✓")
  return worker
}
