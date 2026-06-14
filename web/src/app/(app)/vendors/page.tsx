/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

import { getMembership }  from "@/lib/get-membership"
import { createClient }   from "@/lib/supabase/server"
import { VendorsClient }  from "@/components/vendors/vendors-client"

// Statuses that should not count toward a vendor's totals/doc count
const EXCLUDED_STATUSES = ["rejected", "failed"]

function vendorKey(name: string, taxId?: string | null) {
  return taxId && taxId.trim() ? `tax:${taxId.trim()}` : `name:${name.trim().toLowerCase()}`
}

export default async function VendorsPage() {
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  const [{ data: vendors }, { data: docs }] = await Promise.all([
    supabase
      .from("vendors")
      .select("*")
      .eq("organization_id", orgId)
      .limit(200),
    supabase
      .from("documents")
      .select("vendor_name, vendor_tax_id, status, total_amount, vat_amount, doc_date")
      .eq("organization_id", orgId)
      .not("vendor_name", "is", null)
      .limit(5000),
  ])

  // Aggregate per-vendor stats from the actual documents, grouped using the
  // same matching rule as upsert_vendor() (tax_id when present, else name),
  // so vendors.total_amount/doc_count (incremented on every extracted doc)
  // are recomputed to exclude cancelled/rejected documents.
  type Agg = { docCount: number; total: number; vat: number; lastDate: string | null; statusCounts: Record<string, number> }
  const aggByKey = new Map<string, Agg>()

  for (const d of docs ?? []) {
    if (!d.vendor_name) continue
    const key = vendorKey(d.vendor_name, d.vendor_tax_id)
    let agg = aggByKey.get(key)
    if (!agg) { agg = { docCount: 0, total: 0, vat: 0, lastDate: null, statusCounts: {} }; aggByKey.set(key, agg) }

    agg.statusCounts[d.status] = (agg.statusCounts[d.status] ?? 0) + 1

    if (!EXCLUDED_STATUSES.includes(d.status)) {
      agg.docCount += 1
      agg.total += Number(d.total_amount ?? 0)
      agg.vat   += Number(d.vat_amount ?? 0)
      if (d.doc_date && (!agg.lastDate || d.doc_date > agg.lastDate)) agg.lastDate = d.doc_date
    }
  }

  const vendorsWithStats = (vendors ?? []).map(v => {
    const agg = aggByKey.get(vendorKey(v.name, v.tax_id))
    if (!agg) return { ...v, doc_count: 0, total_amount: 0, vat_total: 0, status_counts: {} }
    return {
      ...v,
      doc_count:     agg.docCount,
      total_amount:  agg.total,
      vat_total:     agg.vat,
      last_doc_date: agg.lastDate ?? v.last_doc_date,
      status_counts: agg.statusCounts,
    }
  }).sort((a, b) => b.total_amount - a.total_amount)

  return <VendorsClient vendors={vendorsWithStats} />
}
