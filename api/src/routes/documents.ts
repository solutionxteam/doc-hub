import type { FastifyInstance } from "fastify"
import { supabase } from "../lib/supabase"
import { queueExtraction, queuePush } from "../queue/setup"

export async function documentsRoutes(app: FastifyInstance) {

  // POST /documents/:id/process — trigger extraction pipeline
  app.post<{ Params: { id: string }; Body: { orgId: string } }>(
    "/:id/process",
    async (req, reply) => {
      const { id } = req.params

      const { data: doc, error } = await supabase
        .from("documents")
        .select("id, file_path, file_type, organization_id")
        .eq("id", id)
        .single()

      if (error || !doc) return reply.status(404).send({ error: "Document not found" })

      // Check quota
      const { data: allowed } = await supabase
        .rpc("increment_doc_used", { p_org_id: doc.organization_id })

      if (!allowed) {
        await supabase.from("documents").update({ status: "failed" }).eq("id", id)
        return reply.status(402).send({ error: "Document quota exceeded" })
      }

      await supabase.from("documents").update({ status: "processing" }).eq("id", id)

      await queueExtraction({
        documentId: id,
        filePath:   doc.file_path,
        fileType:   doc.file_type,
        orgId:      doc.organization_id,
      })

      return { queued: true, documentId: id }
    }
  )

  // POST /documents/:id/push — push to accounting system
  app.post<{ Params: { id: string }; Body: { integrationId: string } }>(
    "/:id/push",
    async (req, reply) => {
      const { id } = req.params
      const { integrationId } = req.body

      if (!integrationId) return reply.status(400).send({ error: "integrationId required" })

      await queuePush({ documentId: id, integrationId })
      return { queued: true }
    }
  )

  // GET /documents/:id/progress — SSE for real-time progress
  app.get<{ Params: { id: string } }>(
    "/:id/progress",
    async (req, reply) => {
      const { id } = req.params

      reply.raw.setHeader("Content-Type", "text/event-stream")
      reply.raw.setHeader("Cache-Control", "no-cache")
      reply.raw.setHeader("Connection", "keep-alive")

      const send = (data: object) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      // Poll DB every 2s for status changes (simple, no Redis dep for SSE)
      let polls = 0
      const interval = setInterval(async () => {
        polls++
        const { data } = await supabase
          .from("documents")
          .select("status, overall_confidence")
          .eq("id", id)
          .single()

        if (data) {
          send({ status: data.status, confidence: data.overall_confidence })

          if (["reviewing", "approved", "failed", "rejected"].includes(data.status)) {
            clearInterval(interval)
            reply.raw.end()
            return
          }
        }

        if (polls > 90) {  // 3 min timeout
          clearInterval(interval)
          reply.raw.end()
        }
      }, 2000)

      req.raw.on("close", () => clearInterval(interval))
    }
  )
}
