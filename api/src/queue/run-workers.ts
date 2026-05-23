/**
 * Worker process entry point.
 * Run separately from the API server: `npm run workers`
 *
 * This process handles:
 *   - Document extraction queue (OCR + AI)
 *   - Document push queue (FlowAccount, PEAK, etc.)
 *   - Integration sync queue
 */

import "dotenv/config"
import { startExtractionWorker } from "./workers/extraction.worker"
import { startPushWorker }       from "./workers/push.worker"

async function main() {
  console.log("🚀 Starting Slipify workers...")

  const extractionWorker = startExtractionWorker()
  const pushWorker       = startPushWorker()

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
