import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET — documents that have line items (suitable for split bill)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = req.nextUrl.searchParams.get("orgId")
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  // Documents with at least one line item
  const { data: docs } = await supabase
    .from("documents")
    .select(`
      id, vendor_name, total_amount, vat_amount, doc_date,
      document_line_items(id, description, amount)
    `)
    .eq("organization_id", orgId)
    .in("status", ["reviewing", "approved", "pushed"])
    .not("document_line_items", "is", null)
    .order("created_at", { ascending: false })
    .limit(30)

  // Filter to only those with actual line items
  const filtered = (docs ?? []).filter(
    d => Array.isArray((d as any).document_line_items) && (d as any).document_line_items.length > 0
  )

  return NextResponse.json({ documents: filtered })
}
