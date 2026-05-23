import type { FastifyInstance } from "fastify"
import { supabase } from "../lib/supabase"
import { encrypt, decrypt } from "../lib/crypto"

export async function integrationsRoutes(app: FastifyInstance) {

  // POST /integrations — save integration API key
  app.post<{
    Body: { orgId: string; provider: string; apiKey: string; meta?: object }
  }>("/", async (req, reply) => {
    const { orgId, provider, apiKey, meta } = req.body

    const encrypted = encrypt(apiKey)

    const { data, error } = await supabase
      .from("integrations")
      .upsert({
        organization_id: orgId,
        provider,
        api_key_enc: encrypted,
        meta:        meta ?? {},
        is_active:   true,
      }, { onConflict: "organization_id,provider" })
      .select("id")
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { integrationId: data.id }
  })

  // DELETE /integrations/:id — remove integration
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { error } = await supabase
      .from("integrations")
      .delete()
      .eq("id", req.params.id)

    if (error) return reply.status(500).send({ error: error.message })
    return { deleted: true }
  })

  // POST /integrations/:id/sync — sync chart of accounts + contacts
  app.post<{ Params: { id: string } }>("/:id/sync", async (req, reply) => {
    const { data: integration } = await supabase
      .from("integrations")
      .select("api_key_enc, provider")
      .eq("id", req.params.id)
      .single()

    if (!integration) return reply.status(404).send({ error: "Integration not found" })

    const apiKey = decrypt(integration.api_key_enc!)

    // Trigger sync (import here to avoid circular deps)
    const { syncFlowAccountData } = await import("../connectors/flowaccount/sync")
    await syncFlowAccountData(req.params.id, apiKey)

    return { synced: true }
  })
}
