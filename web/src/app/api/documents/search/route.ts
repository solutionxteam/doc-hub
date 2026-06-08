import { NextRequest, NextResponse } from "next/server"
import { createClient }  from "@/lib/supabase/server"
import Anthropic         from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

// POST — AI semantic search over documents
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { query, orgId } = await req.json() as { query: string; orgId: string }
  if (!query?.trim() || !orgId) return NextResponse.json({ error: "query and orgId required" }, { status: 400 })

  // Step 1: Claude parses natural language → structured filters
  let filters: Record<string, any> = {}
  try {
    const now = new Date()
    const thisMonth = now.toISOString().slice(0, 7)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7)
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)

    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 300,
      system: `Convert Thai/English document search queries to JSON filters.
Current date: ${now.toISOString().slice(0, 10)}
This month: ${thisMonth}, Last month: ${lastMonth}, 2 months ago: ${twoMonthsAgo}

Available filter fields:
- vendor_name_contains: string (case-insensitive partial match)
- doc_category: "tax_invoice_full"|"tax_invoice_simplified"|"receipt_with_tax"|"receipt"|"consumer_receipt"|"invoice"|"credit_note"|"other"
- status: "reviewing"|"approved"|"pushed"|"failed"
- doc_month: "YYYY-MM" (exact month)
- doc_months: ["YYYY-MM",...] (multiple months)
- total_amount_gte: number
- total_amount_lte: number
- vat_claimable: boolean

Examples:
"HomePro เดือนที่แล้ว" → {"vendor_name_contains":"homepro","doc_month":"${lastMonth}"}
"ใบกำกับภาษีที่รอตรวจสอบ" → {"doc_category":"tax_invoice_full","status":"reviewing"}
"ค่าอาหารเดือนนี้" → {"doc_category":"consumer_receipt","doc_month":"${thisMonth}"}
"น้ำมัน 3 เดือนล่าสุด" → {"vendor_name_contains":"ptt OR shell OR bangchak","doc_months":["${twoMonthsAgo}","${lastMonth}","${thisMonth}"]}
"VAT ขอคืนได้" → {"vat_claimable":true}
"มากกว่า 5000" → {"total_amount_gte":5000}
"อนุมัติแล้ว" → {"status":"approved"}

Return ONLY valid JSON, no explanation.`,
      messages: [{ role: "user", content: query }],
    })

    const raw = (res.content[0] as any).text?.trim() ?? "{}"
    filters = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim())
  } catch {
    // If Claude fails, fall back to simple text search
    filters = { vendor_name_contains: query }
  }

  // Step 2: Build Supabase query from filters
  let q = supabase
    .from("documents")
    .select("id, vendor_name, total_amount, vat_amount, status, doc_date, doc_type, doc_category, overall_confidence, is_duplicate, source, created_at, doc_number")
    .eq("organization_id", orgId)

  if (filters.vendor_name_contains) {
    // Handle OR patterns like "ptt OR shell OR bangchak"
    const terms = filters.vendor_name_contains.split(/\s+OR\s+/i).map((t: string) => t.trim())
    if (terms.length === 1) {
      q = q.ilike("vendor_name", `%${terms[0]}%`)
    } else {
      q = q.or(terms.map((t: string) => `vendor_name.ilike.%${t}%`).join(","))
    }
  }
  if (filters.doc_category)    q = q.eq("doc_category", filters.doc_category)
  if (filters.status)          q = q.eq("status", filters.status)
  if (filters.vat_claimable !== undefined) q = q.eq("vat_claimable", filters.vat_claimable)
  if (filters.total_amount_gte) q = q.gte("total_amount", filters.total_amount_gte)
  if (filters.total_amount_lte) q = q.lte("total_amount", filters.total_amount_lte)

  if (filters.doc_month) {
    const start = `${filters.doc_month}-01`
    const end   = `${filters.doc_month}-31`
    q = q.gte("doc_date", start).lte("doc_date", end)
  }
  if (Array.isArray(filters.doc_months) && filters.doc_months.length > 0) {
    const ranges = filters.doc_months.flatMap((m: string) => [
      `doc_date.gte.${m}-01`, `doc_date.lte.${m}-31`
    ])
    // Use OR for multiple months — simplified: take first and last
    const first = filters.doc_months[0]
    const last  = filters.doc_months[filters.doc_months.length - 1]
    q = q.gte("doc_date", `${first}-01`).lte("doc_date", `${last}-31`)
  }

  const { data: documents, error } = await q
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ documents: documents ?? [], filters, query })
}
