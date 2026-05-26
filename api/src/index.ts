import { config } from "dotenv"
config({ override: true })  // override empty env vars injected by Claude Desktop / shell
import Fastify from "fastify"
import cors from "@fastify/cors"
import multipart from "@fastify/multipart"
import { documentsRoutes }    from "./routes/documents"
import { integrationsRoutes } from "./routes/integrations"
import { stripeRoutes }       from "./routes/stripe"
import { taxRoutes }          from "./routes/tax"
import { lineRoutes }         from "./routes/line"
import { emailRoutes }        from "./routes/email"

const app = Fastify({ logger: true })

// ── Plugins ─────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.APP_URL ?? "http://localhost:3000",
  credentials: true,
})

await app.register(multipart, {
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
})

// ── Auth middleware ─────────────────────────────────────────────
app.addHook("preHandler", async (req, reply) => {
  // Internal calls from Next.js
  if (req.headers["x-internal-key"] === process.env.INTERNAL_API_KEY) return

  // Stripe, LINE, and Email webhooks bypass key auth (verified by own signature/token)
  if (req.url.startsWith("/webhooks/")) return

  reply.status(401).send({ error: "Unauthorized" })
})

// ── Routes ──────────────────────────────────────────────────────
await app.register(documentsRoutes,    { prefix: "/documents"    })
await app.register(integrationsRoutes, { prefix: "/integrations" })
await app.register(stripeRoutes,       { prefix: "/webhooks"     })
await app.register(lineRoutes,         { prefix: "/webhooks"     })
await app.register(emailRoutes,        { prefix: "/webhooks"     })
await app.register(taxRoutes,          { prefix: "/tax"          })

// ── Health check ────────────────────────────────────────────────
app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }))

// ── Start ───────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 4000)
await app.listen({ port, host: "0.0.0.0" })
console.log(`API running on http://localhost:${port}`)
