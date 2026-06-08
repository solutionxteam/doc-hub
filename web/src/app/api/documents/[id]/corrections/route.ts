/**
 * POST /api/documents/[id]/corrections
 *
 * บันทึก field corrections ที่ user แก้ไขจาก AI extraction
 * ใช้เป็น feedback loop สำหรับ few-shot learning
 *
 * Body: {
 *   corrections: Array<{ field: string; aiValue: string | null; correctedValue: string | null }>
 *   vendorName: string       — ชื่อร้านที่ถูกต้อง (หลังแก้)
 *   docCategory: string
 *   confidenceScore: number
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"

interface CorrectionItem {
  field:           string
  aiValue:         string | null
  correctedValue:  string | null
}

interface RequestBody {
  corrections:     CorrectionItem[]
  vendorName:      string | null
  docCategory:     string | null
  confidenceScore: number | null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify document belongs to user's org
  const { data: doc } = await supabase
    .from("documents")
    .select("id, organization_id, overall_confidence, doc_category, vendor_name")
    .eq("id", id)
    .single()

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", doc.organization_id)
    .single()

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body: RequestBody = await req.json()
  const { corrections, vendorName, docCategory, confidenceScore } = body

  // Filter: only save fields that actually changed
  const changed = corrections.filter(c =>
    c.aiValue !== c.correctedValue &&
    !(c.aiValue == null && (c.correctedValue == null || c.correctedValue === ""))
  )

  if (!changed.length) {
    return NextResponse.json({ saved: 0 })
  }

  const rows = changed.map(c => ({
    organization_id:  doc.organization_id,
    document_id:      id,
    field_name:       c.field,
    ai_value:         c.aiValue    != null ? String(c.aiValue)        : null,
    corrected_value:  c.correctedValue != null ? String(c.correctedValue) : null,
    vendor_name:      vendorName   ?? doc.vendor_name,
    doc_category:     docCategory  ?? doc.doc_category,
    confidence_score: confidenceScore ?? doc.overall_confidence,
    corrected_by:     user.id,
  }))

  const { error } = await supabase
    .from("receipt_corrections")
    .insert(rows)

  if (error) {
    console.error("[corrections] insert error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: rows.length })
}
