import type { FastifyInstance } from "fastify"
import { populateLifeGraph, generateInsights } from "../services/life-graph"
import { buildMemoryContext, extractMemoriesFromChat } from "../services/ai-memory"
import { createClient } from "../lib/supabase"

export async function lifeRoutes(app: FastifyInstance) {
  // POST /life/populate
  app.post("/life/populate", async (req, rep) => {
    const { documentId } = req.body as { documentId: string }
    if (!documentId) return rep.status(400).send({ error: "documentId required" })
    const supabase = createClient()
    const { data: doc } = await supabase.from("documents").select("organization_id").eq("id", documentId).single()
    if (!doc) return rep.status(404).send({ error: "Not found" })
    populateLifeGraph(documentId, doc.organization_id).catch(err => console.error("[life] populate:", err.message))
    return rep.send({ ok: true })
  })

  // POST /life/insights/:orgId
  app.post("/life/insights/:orgId", async (req, rep) => {
    const { orgId } = req.params as { orgId: string }
    generateInsights(orgId).catch(err => console.error("[life] insights:", err.message))
    return rep.send({ ok: true })
  })

  // POST /life/memory-context — get AI memory context for a query
  app.post("/life/memory-context", async (req, rep) => {
    const { orgId, query } = req.body as { orgId: string; query: string }
    if (!orgId || !query) return rep.status(400).send({ error: "orgId, query required" })
    const context = await buildMemoryContext(orgId, query).catch(() => "")
    return rep.send({ context })
  })

  // POST /life/extract-memory — extract memories from chat exchange
  app.post("/life/extract-memory", async (req, rep) => {
    const { orgId, userMessage, aiResponse } = req.body as { orgId: string; userMessage: string; aiResponse: string }
    if (!orgId) return rep.status(400).send({ error: "orgId required" })
    extractMemoriesFromChat(orgId, userMessage, aiResponse).catch(err => console.error("[memory] extract:", err.message))
    return rep.send({ ok: true })
  })
}
