import { config } from "dotenv"
config({ override: true })
import { createClient }    from "./src/lib/supabase.js"
import { queueExtraction } from "./src/queue/setup.js"

const sb   = createClient()

// Reset status + queue all confidence=0 reviewing docs
const { data: docs } = await sb
  .from("documents")
  .select("id, file_path, file_type, organization_id, source_meta")
  .eq("overall_confidence", 0)
  .in("status", ["reviewing", "pending", "failed"])

console.log(`Found ${docs?.length ?? 0} zero-confidence documents`)

for (const doc of docs ?? []) {
  const lineUserId = (doc.source_meta as any)?.line_user_id

  // Reset to pending
  await sb.from("documents")
    .update({ status: "pending", notes: null, updated_at: new Date().toISOString() })
    .eq("id", doc.id)

  // Queue extraction
  await queueExtraction({
    documentId: doc.id,
    filePath:   doc.file_path,
    fileType:   doc.file_type === "jpg" ? "image/jpeg" : `image/${doc.file_type}`,
    orgId:      doc.organization_id,
    lineUserId,
  })

  console.log(`  🔄 Queued: ${doc.id.slice(0,8)} (line: ${lineUserId?.slice(0,8) ?? "—"})`)
}

console.log("\n✅ Done — workers will process and notify LINE when complete")
