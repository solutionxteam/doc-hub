import { createClient } from "../lib/supabase"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 *
 * Few-shot learning helper — fetches recently-approved documents + human corrections
 * from the same org and injects them into the extraction prompt.
 *
 * Two sources of learning:
 *   1. Approved documents  — tells AI what the correct output looks like
 *   2. Receipt corrections — tells AI WHERE it went wrong and what the right answer is
 */

export interface FewShotExample {
  doc_category:  string
  vendor_name:   string | null
  vendor_tax_id: string | null
  doc_date:      string | null
  total_amount:  number | null
  vat_amount:    number | null
  subtotal:      number | null
  doc_number:    string | null
  platform_name: string | null
  platform_ref:  string | null
}

export interface VendorCorrection {
  raw_name:     string
  correct_name: string
  count:        number
}

const MAX_EXAMPLES         = 5   // approved document examples
const MAX_VENDOR_ALIASES   = 10  // vendor name corrections to show AI

/**
 * Fetch up to MAX_EXAMPLES recently-approved documents for few-shot injection.
 * Returns an empty array if none found or on any error — never blocks pipeline.
 */
export async function fetchFewShotExamples(
  organizationId: string,
): Promise<FewShotExample[]> {
  try {
    const supabase = createClient()

    const { data } = await supabase
      .from("documents")
      .select(`
        doc_category, vendor_name, vendor_tax_id,
        doc_date, total_amount, vat_amount, subtotal,
        doc_number, platform_name, platform_ref
      `)
      .eq("organization_id", organizationId)
      .in("status", ["approved", "pushed"])
      .not("doc_category", "is", null)
      .not("vendor_name",  "is", null)
      .order("updated_at", { ascending: false })
      .limit(MAX_EXAMPLES * 3) // fetch extra, then deduplicate by vendor

    if (!data?.length) return []

    // Deduplicate: prefer one example per vendor so the AI sees variety
    const seen = new Set<string>()
    const examples: FewShotExample[] = []
    for (const row of data) {
      const key = (row.vendor_name ?? "").toLowerCase().slice(0, 20)
      if (seen.has(key)) continue
      seen.add(key)
      examples.push({
        doc_category:  row.doc_category,
        vendor_name:   row.vendor_name,
        vendor_tax_id: row.vendor_tax_id,
        doc_date:      row.doc_date,
        total_amount:  row.total_amount,
        vat_amount:    row.vat_amount,
        subtotal:      row.subtotal,
        doc_number:    row.doc_number,
        platform_name: row.platform_name,
        platform_ref:  row.platform_ref,
      })
      if (examples.length >= MAX_EXAMPLES) break
    }

    return examples
  } catch {
    return [] // never block the pipeline
  }
}

/**
 * Fetch vendor name corrections (AI got it wrong → user fixed it).
 * Returns pairs: { raw_name, correct_name, count }
 * Used to build a "you misread these before, here are the correct names" block.
 */
export async function fetchVendorCorrections(
  organizationId: string,
): Promise<VendorCorrection[]> {
  try {
    const supabase = createClient()

    // Use the vendor_correction_map view (created in migration 033)
    const { data } = await supabase
      .from("vendor_correction_map")
      .select("raw_name, correct_name, correction_count")
      .eq("organization_id", organizationId)
      .not("raw_name", "is", null)
      .not("correct_name", "is", null)
      .order("correction_count", { ascending: false })
      .limit(MAX_VENDOR_ALIASES)

    if (!data?.length) return []

    return data.map(r => ({
      raw_name:     r.raw_name     as string,
      correct_name: r.correct_name as string,
      count:        Number(r.correction_count ?? 1),
    }))
  } catch {
    return []
  }
}

/**
 * Format few-shot examples + vendor corrections as a compact prompt block.
 * Returns empty string when there are no examples.
 */
export function formatFewShotBlock(
  examples:    FewShotExample[],
  corrections: VendorCorrection[] = [],
): string {
  const parts: string[] = []

  // ── Section 1: Approved document examples ────────────────────────────────────
  if (examples.length) {
    const lines = examples.map((ex, i) => {
      const obj: Record<string, unknown> = { doc_category: ex.doc_category }
      if (ex.vendor_name)   obj.vendor_name   = ex.vendor_name
      if (ex.vendor_tax_id) obj.vendor_tax_id = ex.vendor_tax_id
      if (ex.platform_name) obj.platform_name = ex.platform_name
      if (ex.platform_ref)  obj.platform_ref  = ex.platform_ref
      if (ex.doc_number)    obj.doc_number    = ex.doc_number
      if (ex.doc_date)      obj.doc_date      = ex.doc_date
      if (ex.total_amount)  obj.total_amount  = ex.total_amount
      if (ex.vat_amount)    obj.vat_amount    = ex.vat_amount
      if (ex.subtotal)      obj.subtotal      = ex.subtotal
      return `  Example ${i + 1}: ${JSON.stringify(obj)}`
    })

    parts.push(
      `## Previously approved extractions from this organisation (use as reference for naming conventions):\n` +
      lines.join("\n")
    )
  }

  // ── Section 2: Vendor name corrections (Human Learning) ──────────────────────
  if (corrections.length) {
    const rows = corrections.map(c =>
      `  "${c.raw_name}" → correct name is "${c.correct_name}"${c.count > 1 ? ` (corrected ${c.count}×)` : ""}`
    )
    parts.push(
      `## ⚠️ Known vendor name misreads — you previously got these wrong, use the correct names:\n` +
      rows.join("\n") + "\n" +
      `  If you see any of the "raw" names above in the image, output the correct name instead.`
    )
  }

  if (!parts.length) return ""
  return parts.join("\n\n") + "\n\n---\n"
}
