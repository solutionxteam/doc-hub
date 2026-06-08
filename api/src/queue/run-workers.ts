/**
 * Worker process entry point.
 * Run separately from the API server: `npm run workers`
 *
 * This process handles:
 *   - Document extraction queue (OCR + AI)
 *   - Document push queue (FlowAccount, PEAK, etc.)
 *   - Integration sync queue
 */

// ⚠️  IMPORTANT: dotenv MUST be loaded before any module that reads process.env at init time.
// In ESM, static `import` statements are hoisted — they run before this file's body code.
// Solution: use `config()` here (it's a side-effect at top of body), then *dynamically*
// import the worker modules so they load AFTER env is fully populated.
import { config } from "dotenv"
config({ override: true })  // override empty/stale vars injected by Claude Desktop

// Verify critical vars are present before starting
const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "ANTHROPIC_API_KEY", "LINE_CHANNEL_ACCESS_TOKEN"]
const missing  = REQUIRED.filter(k => !process.env[k])
if (missing.length) {
  console.error("❌ Missing required env vars:", missing.join(", "))
  process.exit(1)
}
console.log("✅ Env loaded:", REQUIRED.map(k => `${k}=${process.env[k]!.slice(0,6)}…`).join("  "))

async function main() {
  // Dynamic imports ensure modules load AFTER config() above has populated process.env
  const { startExtractionWorker }                              = await import("./workers/extraction.worker")
  const { startPushWorker }                                    = await import("./workers/push.worker")
  const { checkAndSendReminders, generateDailyLogs, checkLowStock } = await import("../services/medication-reminder")

  console.log("🚀 Starting Slippy workers...")

  const extractionWorker = startExtractionWorker()
  const pushWorker       = startPushWorker()

  // ── Medication Reminder Service ───────────────────────────────────────────
  // Generate daily medication logs at startup and every midnight
  await generateDailyLogs().catch(e => console.warn("[med] daily gen:", e.message))

  // Check reminders every 60 seconds
  const medReminderInterval = setInterval(async () => {
    await checkAndSendReminders().catch(e => console.warn("[med] reminder:", e.message))
  }, 60_000)

  // Regenerate daily logs at midnight + check low stock
  const now   = new Date()
  const night = new Date(now)
  night.setHours(23, 59, 0, 0)
  const msToMidnight = Math.max(0, night.getTime() - now.getTime())
  setTimeout(async () => {
    await generateDailyLogs().catch(() => {})
    await checkLowStock().catch(() => {})
    setInterval(async () => {
      await generateDailyLogs().catch(() => {})
      await checkLowStock().catch(() => {})
    }, 24 * 60 * 60 * 1000)
  }, msToMidnight)

  console.log("💊 Medication reminder service started")
  console.log("✅ All workers running. Waiting for jobs...")

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n⚠️  Received ${signal}. Shutting down workers gracefully...`)
    await Promise.all([
      extractionWorker.close(),
      pushWorker.close(),
    ])
    console.log("✅ Workers shut down cleanly.")
    process.exit(0)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT",  () => shutdown("SIGINT"))

  // Keep process alive
  await new Promise(() => { /* run forever */ })
}

main().catch(err => {
  console.error("Fatal worker error:", err)
  process.exit(1)
})
