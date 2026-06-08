import { config } from "dotenv"
config({ override: true })
import { createClient } from "./src/lib/supabase.js"
import { notifyLineAfterExtraction } from "./src/routes/line.js"

const supabase = createClient()

const { data: docs } = await supabase
  .from("documents")
  .select("id, source, source_meta, vendor_name, overall_confidence, status")
  .eq("source", "line")
  .in("status", ["reviewing", "approved"])
  .order("created_at", { ascending: false })
  .limit(10)

console.log(`Found ${docs?.length ?? 0} recent LINE docs — sending notifications...`)

for (const doc of docs ?? []) {
  const lineUserId = (doc.source_meta as any)?.line_user_id
  if (!lineUserId) { console.log(`  ⚠️ skip ${doc.id.slice(0,8)} — no lineUserId`); continue }
  try {
    await notifyLineAfterExtraction(
      doc.id, "",
      { success: true, confidence_score: doc.overall_confidence ?? 0 },
      lineUserId
    )
    console.log(`  ✅ ${doc.vendor_name ?? doc.id.slice(0,8)} (${doc.status})`)
  } catch (e: any) {
    console.log(`  ❌ ${doc.id.slice(0,8)}: ${e.message?.slice(0,80)}`)
  }
}
