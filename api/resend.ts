import { config } from "dotenv"
config({ override: true })
import { createClient } from "./src/lib/supabase.js"
import { notifyLineAfterExtraction } from "./src/routes/line.js"

const sb = createClient()
const { data: docs } = await sb
  .from("documents")
  .select("id, source, source_meta, vendor_name, overall_confidence, status")
  .eq("source", "line")
  .in("status", ["reviewing", "approved"])
  .order("created_at", { ascending: false })
  .limit(5)

for (const doc of docs ?? []) {
  const uid = (doc.source_meta as any)?.line_user_id
  if (!uid) { console.log(`  skip ${doc.id.slice(0,8)} — no uid`); continue }
  try {
    await notifyLineAfterExtraction(doc.id, "", { success: true, confidence_score: doc.overall_confidence ?? 0 }, uid)
    console.log(`  ✅ ${doc.vendor_name ?? doc.id.slice(0,8)} → LINE`)
  } catch (e: any) { console.log(`  ❌ ${e.message?.slice(0,80)}`) }
}
