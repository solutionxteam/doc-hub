/**
 * LINE Bot Local Test Script
 * ──────────────────────────
 * ส่ง mock webhook events ไปยัง local API server โดยไม่ต้องใช้ LINE จริง
 *
 * Usage:
 *   npx tsx scripts/test-line-bot.ts follow
 *   npx tsx scripts/test-line-bot.ts connect ABC123
 *   npx tsx scripts/test-line-bot.ts image
 *   npx tsx scripts/test-line-bot.ts summary
 *   npx tsx scripts/test-line-bot.ts status
 *   npx tsx scripts/test-line-bot.ts approve a1b2c3d4
 *   npx tsx scripts/test-line-bot.ts reject  a1b2c3d4
 *   npx tsx scripts/test-line-bot.ts help
 */
import crypto from "node:crypto"
import { config } from "dotenv"
config()

const API_URL   = process.env.API_URL ?? "http://localhost:4000"
const SECRET    = process.env.LINE_CHANNEL_SECRET ?? "test-secret"
const LINE_USER = "U" + "a".repeat(32)  // mock LINE user ID

function makeSignature(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("base64")
}

function baseEvent(type: string, extra: object = {}) {
  return {
    type,
    timestamp: Date.now(),
    source:    { type: "user", userId: LINE_USER },
    replyToken: "mock-reply-token-" + Date.now(),
    ...extra,
  }
}

async function sendWebhook(events: object[]) {
  const body = JSON.stringify({ destination: "mock", events })
  const sig  = makeSignature(body)

  const res = await fetch(`${API_URL}/webhooks/line`, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-line-signature":  sig,
    },
    body,
  })

  const text = await res.text()
  console.log(`\n[${res.status}] POST /webhooks/line`)
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)) }
  catch { console.log(text) }
}

function textEvent(text: string) {
  return baseEvent("message", {
    message: { id: "msg-" + Date.now(), type: "text", text },
  })
}

function imageEvent() {
  return baseEvent("message", {
    message: {
      id:          "img-" + Date.now(),
      type:        "image",
      contentProvider: { type: "line" },
    },
  })
}

// ── CLI dispatch ──────────────────────────────────────────────────────────────
const [, , cmd, arg1] = process.argv

async function main() {
  switch (cmd) {
    case "follow":
      console.log("→ Simulating: follow event (new user)")
      await sendWebhook([baseEvent("follow")])
      break

    case "connect":
      console.log(`→ Simulating: /connect ${arg1 ?? "ABC123"}`)
      await sendWebhook([textEvent(`/connect ${arg1 ?? "ABC123"}`)])
      break

    case "image":
      console.log("→ Simulating: image message (slip/receipt)")
      console.log("  Note: Image download will fail without real LINE message ID.")
      console.log("  Check server logs for the upload attempt.")
      await sendWebhook([imageEvent()])
      break

    case "summary":
      console.log("→ Simulating: /summary command")
      await sendWebhook([textEvent("/summary")])
      break

    case "status":
      console.log("→ Simulating: /status command")
      await sendWebhook([textEvent("/status")])
      break

    case "approve":
      console.log(`→ Simulating: /approve ${arg1 ?? "DOCID"}`)
      await sendWebhook([textEvent(`/approve ${arg1 ?? "DOCID"}`)])
      break

    case "reject":
      console.log(`→ Simulating: /reject ${arg1 ?? "DOCID"}`)
      await sendWebhook([textEvent(`/reject ${arg1 ?? "DOCID"}`)])
      break

    case "help":
      console.log("→ Simulating: /help command")
      await sendWebhook([textEvent("/help")])
      break

    default:
      console.log(`
LINE Bot Test Script
════════════════════
Commands:
  follow              — simulate new follower
  connect CODE        — simulate /connect CODE
  image               — simulate sending an image
  summary             — simulate /summary
  status              — simulate /status
  approve DOCID       — simulate /approve <docId prefix>
  reject  DOCID       — simulate /reject  <docId prefix>
  help                — simulate /help

Examples:
  npx tsx scripts/test-line-bot.ts follow
  npx tsx scripts/test-line-bot.ts connect ABC123
  npx tsx scripts/test-line-bot.ts summary
`)
  }
}

main().catch(console.error)
