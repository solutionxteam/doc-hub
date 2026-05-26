import { createClient } from "../lib/supabase"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 *
 * Few-shot learning helper — fetches recently-approved documents from the same
 * org and returns compact JSON examples to inject into the extraction prompt.
 *
 * This allows the AI to learn the naming patterns and document formats used by
 * THIS specific organisation (e.g. their vendors, doc number formats, etc.).
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

const MAX_EXAMPLES   = 3   // keep prompt small
const MAX_TOKENS_EST = 400 // rough estimate per example

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
 * Format few-shot examples as a compact prompt block.
 * Returns empty string when there are no examples.
 */
export function formatFewShotBlock(examples: FewShotExample[]): string {
  if (!examples.length) return ""

  const lines = examples.map((ex, i) => {
    // Build a compact subset — skip nulls to save tokens
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
    return `Example ${i + 1}: ${JSON.stringify(obj)}`
  })

  return `## Previously approved extractions from this organisation (use as reference for naming conventions and formats):
${lines.join("\n")}

---
`
}
