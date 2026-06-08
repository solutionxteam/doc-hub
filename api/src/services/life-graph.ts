/**
 * life-graph.ts — Life Graph Service
 *
 * Auto-populates the Life Graph whenever a document is approved/processed.
 * Builds: life_merchants, life_events, life_memories
 *
 * Core principle (CLAUDE.md): every feature must enrich the Life Graph.
 * Documents are the primary data source for Wealth domain.
 */

import { createClient } from "../lib/supabase"

// ─── Populate Life Graph from an approved document ────────────────────────────
export async function populateLifeGraph(
  documentId:     string,
  organizationId: string
): Promise<void> {
  const supabase = createClient()
  const tag = `[life-graph:${documentId.slice(0, 8)}]`

  // Fetch document with full detail
  const { data: doc, error } = await supabase
    .from("documents")
    .select(`
      id, vendor_name, vendor_tax_id, vendor_address,
      total_amount, vat_amount, doc_date, doc_category,
      vat_claimable, expense_claimable, payment_method,
      uploaded_by, status
    `)
    .eq("id", documentId)
    .single()

  if (error || !doc) {
    console.warn(tag, "Document not found:", error?.message)
    return
  }

  // Only process approved/pushed documents
  if (!["approved", "pushed"].includes(doc.status)) return

  const occurredAt = doc.doc_date
    ? new Date(doc.doc_date).toISOString()
    : new Date().toISOString()

  try {
    // ── 1. Upsert merchant in Life Graph ──────────────────────────────────────
    let merchantId: string | null = null
    if (doc.vendor_name?.trim()) {
      const { data: mid } = await supabase.rpc("upsert_life_merchant", {
        p_org_id:   organizationId,
        p_name:     doc.vendor_name.trim(),
        p_tax_id:   doc.vendor_tax_id ?? null,
        p_address:  doc.vendor_address ?? null,
        p_category: doc.doc_category ?? null,
        p_amount:   doc.total_amount ?? 0,
        p_date:     occurredAt,
      })
      merchantId = mid
      console.log(tag, `Merchant upserted: ${doc.vendor_name} → ${mid}`)
    }

    // ── 2. Create life event ──────────────────────────────────────────────────
    // Check for duplicate event first
    const { data: existing } = await supabase
      .from("life_events")
      .select("id")
      .eq("source_type", "document")
      .eq("source_id", documentId)
      .maybeSingle()

    if (existing) {
      console.log(tag, "Life event already exists, skipping")
    } else {
      await supabase.from("life_events").insert({
        organization_id: organizationId,
        user_id:         doc.uploaded_by ?? null,
        event_type:      "expense",
        source_type:     "document",
        source_id:       documentId,
        merchant_id:     merchantId,
        amount:          doc.total_amount ?? 0,
        category:        mapCategory(doc.doc_category),
        doc_category:    doc.doc_category,
        description:     doc.vendor_name ?? "ค่าใช้จ่าย",
        occurred_at:     occurredAt,
        metadata: {
          vat_amount:      doc.vat_amount,
          vat_claimable:   doc.vat_claimable,
          payment_method:  doc.payment_method,
        },
      })
      console.log(tag, "Life event created: expense", doc.total_amount)
    }

    // ── 3. Update AI memory (spending patterns) ───────────────────────────────
    await updateMemories(organizationId, doc, merchantId, supabase)

  } catch (err: any) {
    console.error(tag, "Life graph population failed:", err.message)
  }
}

// ─── Update AI Memory from this document ──────────────────────────────────────
async function updateMemories(
  orgId:      string,
  doc:        any,
  merchantId: string | null,
  supabase:   ReturnType<typeof createClient>
): Promise<void> {

  const upsertMemory = async (type: string, key: string, value: object) => {
    await supabase.from("life_memories").upsert({
      organization_id:    orgId,
      memory_type:        type,
      key,
      value,
      observation_count:  1,
      updated_at:         new Date().toISOString(),
    }, { onConflict: "organization_id,memory_type,key" })
  }

  // Remember merchant preference
  if (merchantId && doc.vendor_name) {
    await supabase.from("life_memories")
      .upsert({
        organization_id:   orgId,
        memory_type:       "merchant_visit",
        key:               merchantId,
        value:             { name: doc.vendor_name, last_amount: doc.total_amount, category: doc.doc_category },
        observation_count: 1,
        updated_at:        new Date().toISOString(),
      }, { onConflict: "organization_id,memory_type,key" })
  }

  // Remember doc category patterns
  if (doc.doc_category && doc.total_amount > 0) {
    await upsertMemory("category_spend", doc.doc_category, {
      category:    doc.doc_category,
      last_amount: doc.total_amount,
      label:       mapCategory(doc.doc_category),
    })
  }
}

// ─── Generate AI Insights for an org ─────────────────────────────────────────
export async function generateInsights(organizationId: string): Promise<void> {
  const supabase = createClient()
  const tag      = `[insights:${organizationId.slice(0, 8)}]`

  // Get spending for last 30 days and compare to previous 30 days
  const now  = new Date()
  const d30  = new Date(now.getTime() - 30 * 86400000).toISOString()
  const d60  = new Date(now.getTime() - 60 * 86400000).toISOString()

  const { data: recent } = await supabase
    .from("life_events")
    .select("amount, category, doc_category, merchant_id, occurred_at")
    .eq("organization_id", organizationId)
    .eq("event_type", "expense")
    .gte("occurred_at", d30)

  const { data: previous } = await supabase
    .from("life_events")
    .select("amount, category, doc_category")
    .eq("organization_id", organizationId)
    .eq("event_type", "expense")
    .gte("occurred_at", d60)
    .lt("occurred_at", d30)

  if (!recent?.length) return

  // Total spending comparison
  const recentTotal   = recent.reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const previousTotal = (previous ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)

  const insights: object[] = []

  if (previousTotal > 0) {
    const changePct = ((recentTotal - previousTotal) / previousTotal) * 100
    if (Math.abs(changePct) >= 10) {
      insights.push({
        organization_id: organizationId,
        insight_type:    "spending",
        title:           changePct > 0
          ? `🔴 ค่าใช้จ่ายเพิ่มขึ้น ${changePct.toFixed(0)}% จากเดือนที่แล้ว`
          : `🟢 ค่าใช้จ่ายลดลง ${Math.abs(changePct).toFixed(0)}% จากเดือนที่แล้ว`,
        body:            `30 วันที่ผ่านมา: ฿${recentTotal.toLocaleString()} vs ก่อนหน้า: ฿${previousTotal.toLocaleString()}`,
        data:            { recent_total: recentTotal, previous_total: previousTotal, change_pct: changePct },
        period_start:    d30.slice(0, 10),
        period_end:      now.toISOString().slice(0, 10),
        priority:        changePct > 0 ? 2 : 1,
        expires_at:      new Date(now.getTime() + 7 * 86400000).toISOString(),
      })
    }
  }

  // Category breakdown insights
  const byCat: Record<string, number> = {}
  for (const e of recent) {
    const cat = e.doc_category ?? "other"
    byCat[cat] = (byCat[cat] ?? 0) + Number(e.amount ?? 0)
  }
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
  if (topCat) {
    const [cat, amount] = topCat
    const pct = (amount / recentTotal) * 100
    insights.push({
      organization_id: organizationId,
      insight_type:    "habit",
      title:           `📊 ${mapCategory(cat)} คิดเป็น ${pct.toFixed(0)}% ของค่าใช้จ่าย`,
      body:            `ใช้ไป ฿${amount.toLocaleString()} ใน 30 วันที่ผ่านมา`,
      data:            { category: cat, amount, percent: pct },
      period_start:    d30.slice(0, 10),
      period_end:      now.toISOString().slice(0, 10),
      priority:        0,
      expires_at:      new Date(now.getTime() + 7 * 86400000).toISOString(),
    })
  }

  // Merchant frequency insight
  const merchantCounts: Record<string, number> = {}
  for (const e of recent) {
    if (e.merchant_id) merchantCounts[e.merchant_id] = (merchantCounts[e.merchant_id] ?? 0) + 1
  }
  const topMerchant = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0]
  if (topMerchant && topMerchant[1] >= 3) {
    const { data: m } = await supabase.from("life_merchants").select("name").eq("id", topMerchant[0]).single()
    if (m) {
      insights.push({
        organization_id: organizationId,
        insight_type:    "habit",
        title:           `🏪 คุณไป ${m.name} ถึง ${topMerchant[1]} ครั้ง`,
        body:            `ใน 30 วันที่ผ่านมา — ร้านที่ไปบ่อยที่สุด`,
        data:            { merchant_id: topMerchant[0], count: topMerchant[1] },
        period_start:    d30.slice(0, 10),
        period_end:      now.toISOString().slice(0, 10),
        priority:        0,
        expires_at:      new Date(now.getTime() + 7 * 86400000).toISOString(),
      })
    }
  }

  if (insights.length > 0) {
    await supabase.from("life_insights").insert(insights)
    console.log(tag, `Generated ${insights.length} insights`)
  }
}

// ─── Compute Life Score ───────────────────────────────────────────────────────
export async function computeLifeScore(organizationId: string): Promise<{
  overall: number
  wealth: number
  components: Record<string, number>
}> {
  const supabase = createClient()
  const now      = new Date()
  const d30      = new Date(now.getTime() - 30 * 86400000).toISOString()

  // Wealth score: based on document consistency + approved count
  const { count: totalDocs }    = await supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId)
  const { count: approvedDocs } = await supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "approved")

  const approvalRate = totalDocs ? (approvedDocs ?? 0) / totalDocs : 0
  const wealthScore  = Math.round(approvalRate * 70 + Math.min(totalDocs ?? 0, 30))

  // Life events diversity
  const { data: events } = await supabase.from("life_events")
    .select("event_type")
    .eq("organization_id", organizationId)
    .gte("occurred_at", d30)

  const eventTypes  = new Set((events ?? []).map(e => e.event_type))
  const diversity   = Math.round(eventTypes.size * 20)

  const overall = Math.min(100, Math.round((wealthScore * 0.6 + diversity * 0.4)))

  return {
    overall,
    wealth: wealthScore,
    components: { approval_rate: Math.round(approvalRate * 100), diversity, doc_count: totalDocs ?? 0 },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mapCategory(cat: string | null): string {
  const map: Record<string, string> = {
    tax_invoice_full:       "ใบกำกับภาษี",
    tax_invoice_simplified: "ค้าปลีก",
    receipt_with_tax:       "ใบเสร็จ/VAT",
    receipt:                "ใบเสร็จ",
    consumer_receipt:       "อาหาร/บริการ",
    invoice:                "ใบแจ้งหนี้",
    credit_note:            "ใบลดหนี้",
    other:                  "อื่นๆ",
  }
  return map[cat ?? ""] ?? cat ?? "อื่นๆ"
}
