/**
 * travel-doc.ts — read a travel document into proposed itinerary entries.
 *
 * Called by the web app (web/src/app/api/trips/[id]/import-document/route.ts).
 * Protected by x-internal-key, enforced by the parent plugin in src/index.ts —
 * this route does NOT re-check it.
 *
 * Reads only. Nothing here writes to the database: the web app shows the
 * proposals, a person accepts them, and the existing itinerary endpoints do the
 * writing. That split is deliberate — see pipeline/travel-doc.ts.
 */
import type { FastifyInstance } from "fastify"
import { readTravelDocument } from "../pipeline/travel-doc"

/** What a vision model can actually read. */
const ACCEPTED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
])

const MAX_BYTES = 12 * 1024 * 1024

export async function travelDocRoutes(app: FastifyInstance) {
  /**
   * POST /travel-doc/read
   * Body: { fileBase64: string, mimeType: string, fileName?: string }
   *
   * Base64 in the body rather than multipart: the caller is the Next.js server,
   * which already holds the bytes, and one JSON hop is simpler than re-streaming
   * a multipart body between two services.
   */
  app.post<{ Body: { fileBase64?: string; mimeType?: string; fileName?: string } }>(
    "/travel-doc/read",
    async (req, reply) => {
      const { fileBase64, mimeType, fileName } = req.body ?? {}

      if (!fileBase64 || !mimeType) {
        return reply.code(400).send({ error: "fileBase64 และ mimeType จำเป็นต้องมี" })
      }
      if (!ACCEPTED.has(mimeType)) {
        return reply.code(415).send({
          error: `ไฟล์ชนิด ${mimeType} อ่านไม่ได้ — รองรับ JPEG, PNG, WebP, GIF และ PDF`,
        })
      }

      let buffer: Buffer
      try {
        buffer = Buffer.from(fileBase64, "base64")
      } catch {
        return reply.code(400).send({ error: "fileBase64 ไม่ใช่ base64 ที่ถูกต้อง" })
      }
      if (!buffer.length) {
        return reply.code(400).send({ error: "ไฟล์ว่าง" })
      }
      if (buffer.length > MAX_BYTES) {
        return reply.code(413).send({
          error: `ไฟล์ใหญ่เกินไป (${(buffer.length / 1024 / 1024).toFixed(1)} MB) — จำกัดที่ 12 MB`,
        })
      }

      const started = Date.now()
      try {
        const result = await readTravelDocument(buffer, mimeType)
        app.log.info({
          fileName, mimeType, bytes: buffer.length,
          pages: result.pages_read, items: result.items.length,
          ms: Date.now() - started,
        }, "travel-doc read")
        return reply.send(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : "อ่านเอกสารไม่สำเร็จ"
        // Logged with the file's shape but never its contents — a boarding pass
        // carries a passenger name and a booking reference.
        app.log.error({ fileName, mimeType, bytes: buffer.length, message }, "travel-doc failed")
        return reply.code(502).send({ error: message })
      }
    },
  )
}
