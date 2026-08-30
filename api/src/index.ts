import { config } from "dotenv"
config({ override: true })
import Fastify    from "fastify"
import cors       from "@fastify/cors"
import multipart  from "@fastify/multipart"
import { documentsRoutes }    from "./routes/documents"
import { integrationsRoutes } from "./routes/integrations"
import { stripeRoutes }       from "./routes/stripe"
import { taxRoutes }          from "./routes/tax"
import { lineRoutes }         from "./routes/line"
import { emailRoutes }        from "./routes/email"
import { lifeRoutes }         from "./routes/life"
import { sportNotifyRoutes }  from "./routes/sport-notify"
import { tripNotifyRoutes }   from "./routes/trip-notify"
import { travelDocRoutes }      from "./routes/travel-doc"

const app = Fastify({ logger: true })

// ── Shared plugins ───────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.APP_URL ?? "http://localhost:3000",
  credentials: true,
})

await app.register(multipart, {
  limits: { fileSize: 20 * 1024 * 1024 },
})

// ── Raw body capture (for LINE/Stripe HMAC verification) ─────────
app.addContentTypeParser(
  "application/json",
  { parseAs: "buffer" },
  (req, body, done) => {
    ;(req as any).rawBody = body
    try { done(null, JSON.parse(body.toString("utf8"))) }
    catch (e: any) { done(e, undefined) }
  }
)

// ── Health check (public) ────────────────────────────────────────
app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }))

// ── Static assets served by API (used in LINE Flex Messages) ─────
// LINE fetches these when rendering Flex Message images
app.get("/icon-192.png", async (_req, reply) => {
  const fs   = await import("node:fs")
  const path = await import("node:path")
  // process.cwd() = api/ directory; icon is in ../web/public/
  const file = path.resolve(process.cwd(), "../web/public/icon-192.png")
  if (!fs.existsSync(file)) {
    return reply.status(404).send({ error: "not found" })
  }
  reply.header("Content-Type", "image/png")
  reply.header("Cache-Control", "public, max-age=86400")
  return reply.send(fs.createReadStream(file))
})

// ── LIFF proxy — redirect /liff/* to Next.js web server ──────────
// ใช้เมื่อ ngrok ชี้ไปที่ API (4000) แต่ LIFF pages อยู่ที่ Web (3000)
const WEB_URL = process.env.WEB_URL ?? "https://localhost:3000"
app.get("/liff", async (_req, reply) => reply.redirect(`${WEB_URL}/liff/places`))
app.get("/liff/*", async (req, reply) => {
  const path = (req.params as any)["*"] ?? ""
  const qs   = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""
  return reply.redirect(`${WEB_URL}/liff/${path}${qs}`)
})

// ── Webhook routes — NO auth (each verifies its own signature) ───
// Registered in root scope so they are NOT affected by the auth hook below.
await app.register(stripeRoutes, { prefix: "/webhooks" })
await app.register(lineRoutes,   { prefix: "/webhooks" })
await app.register(emailRoutes,  { prefix: "/webhooks" })

// ── Protected routes — scoped plugin with auth ───────────────────
// All routes registered inside this plugin require x-internal-key.
await app.register(async (authed) => {
  authed.addHook("preHandler", async (req, reply) => {
    if (req.headers["x-internal-key"] === process.env.INTERNAL_API_KEY) return
    return reply.status(401).send({ error: "Unauthorized" })
  })

  await authed.register(documentsRoutes,    { prefix: "/documents"    })
  await authed.register(integrationsRoutes, { prefix: "/integrations" })
  await authed.register(taxRoutes,          { prefix: "/tax"          })
  await authed.register(lifeRoutes)   // Life Graph routes (no prefix — /life/*)
  await authed.register(sportNotifyRoutes)  // /sport/notify
  await authed.register(tripNotifyRoutes)   // /trip/notify
  await authed.register(travelDocRoutes)    // /travel-doc/read
})

// ── Start ────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 4000)
await app.listen({ port, host: "0.0.0.0" })
console.log(`API running on http://localhost:${port}`)
