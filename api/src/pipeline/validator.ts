import { createClient } from "../lib/supabase"
import type { ExtractedDocument } from "./extractor"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

const VAT_RATE = 0.07

// Categories where strict tax-invoice checks are relaxed
const CONSUMER_CATEGORIES = new Set([
  "consumer_receipt",
  "receipt",
  "tax_invoice_simplified",
])

export interface ValidationResult {
  is_valid:         boolean
  confidence_score: number
  warnings:         ValidationWarning[]
  is_duplicate:     boolean
  duplicate_doc_id?: string
}

export interface ValidationWarning {
  code:    string
  message: string
  field?:  string
}

/**
 * Validate extracted document data.
 *
 * Rules are tiered by document category:
 *  • tax_invoice_full / receipt_with_tax / credit_note  → full strict checks
 *  • tax_invoice_simplified / receipt / consumer_receipt → relaxed (no doc_number,
 *    no VAT math, no tax-ID check)
 *  • invoice / other → basic checks only
 */
export async function validateDocument(
  extracted:       ExtractedDocument,
  organizationId:  string,
  excludeDocId?:   string,
): Promise<ValidationResult> {
  const warnings: ValidationWarning[] = []
  let score = extracted.confidence_score

  const isConsumer = CONSUMER_CATEGORIES.has(extracted.doc_category)
  const isTaxInvoiceFull = extracted.doc_category === "tax_invoice_full" ||
                           extracted.doc_category === "receipt_with_tax"

  // ── 1. Required field checks ─────────────────────────────────────────────────
  if (!extracted.vendor_name?.trim()) {
    warnings.push({ code: "MISSING_VENDOR", message: "ไม่พบชื่อผู้ขาย/ผู้ให้บริการ", field: "vendor_name" })
    score = Math.max(0, score - 0.2)
  }

  // doc_number: required only for full tax invoices
  if (isTaxInvoiceFull && !extracted.doc_number?.trim()) {
    warnings.push({ code: "MISSING_DOC_NUM", message: "ไม่พบเลขที่ใบกำกับภาษี", field: "doc_number" })
    score = Math.max(0, score - 0.1)
  }

  if (!extracted.doc_date) {
    warnings.push({ code: "MISSING_DATE", message: "ไม่พบวันที่เอกสาร", field: "doc_date" })
    score = Math.max(0, score - 0.1)
  }

  if (extracted.total_amount <= 0) {
    warnings.push({ code: "ZERO_TOTAL", message: "ยอดรวมเป็น 0 หรือไม่ถูกต้อง", field: "total_amount" })
    score = Math.max(0, score - 0.25)
  }

  // ── 2. VAT math — only for full tax invoices that show VAT explicitly ────────
  if (isTaxInvoiceFull && extracted.vat_amount > 0 && extracted.subtotal > 0) {
    const expectedVat = extracted.subtotal * VAT_RATE
    const tolerance   = Math.max(1, extracted.subtotal * 0.001)

    if (Math.abs(extracted.vat_amount - expectedVat) > tolerance) {
      warnings.push({
        code:    "VAT_MISMATCH",
        message: `VAT ไม่ตรงกับ 7% ของ subtotal (คาดว่า ${expectedVat.toFixed(2)}, ได้ ${extracted.vat_amount.toFixed(2)})`,
        field:   "vat_amount",
      })
      score = Math.max(0, score - 0.1)
    }
  }

  // ── 3. Total consistency — skip for consumer receipts (discounts/fees vary) ──
  if (!isConsumer && extracted.subtotal > 0) {
    const expectedTotal = extracted.subtotal + extracted.vat_amount - extracted.wht_amount
    const tolerance     = Math.max(1, extracted.total_amount * 0.005)  // 0.5%

    if (Math.abs(extracted.total_amount - expectedTotal) > tolerance) {
      warnings.push({
        code:    "TOTAL_MISMATCH",
        message: `ยอดรวมไม่ตรงกัน: subtotal+VAT-WHT = ${expectedTotal.toFixed(2)}, ยอดที่อ่านได้ ${extracted.total_amount.toFixed(2)}`,
        field:   "total_amount",
      })
      score = Math.max(0, score - 0.15)
    }
  }

  // ── 4. Date sanity ───────────────────────────────────────────────────────────
  if (extracted.doc_date) {
    const docDate     = new Date(extracted.doc_date)
    const now         = new Date()
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())

    if (isNaN(docDate.getTime())) {
      warnings.push({ code: "INVALID_DATE", message: "รูปแบบวันที่ไม่ถูกต้อง", field: "doc_date" })
      score = Math.max(0, score - 0.1)
    } else if (docDate > now) {
      warnings.push({ code: "FUTURE_DATE", message: "วันที่เอกสารอยู่ในอนาคต", field: "doc_date" })
      score = Math.max(0, score - 0.05)
    } else if (docDate < twoYearsAgo) {
      warnings.push({ code: "OLD_DATE", message: "วันที่เอกสารเก่ากว่า 2 ปี", field: "doc_date" })
    }
  }

  // ── 5. Duplicate detection ───────────────────────────────────────────────────
  let is_duplicate    = false
  let duplicate_doc_id: string | undefined

  const supabase = createClient()

  // 5a. Platform ref check — highest confidence, unique per org
  if (extracted.platform_ref?.trim()) {
    const { data: refMatch } = await supabase
      .from("documents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("platform_ref",    extracted.platform_ref.trim())
      .in("status",          ["reviewing", "approved", "pushed"])
      .neq("id",             excludeDocId ?? "00000000-0000-0000-0000-000000000000")
      .limit(1)

    if (refMatch && refMatch.length > 0) {
      is_duplicate     = true
      duplicate_doc_id = refMatch[0].id
      warnings.push({ code: "DUPLICATE", message: `พบเอกสารซ้ำ — Delivery ref ซ้ำกัน (id: ${refMatch[0].id})` })
      score = Math.max(0, score - 0.3)
    }
  }

  // 5b. Fallback: vendor + amount (+ doc_number if available)
  if (!is_duplicate && extracted.vendor_name && extracted.total_amount > 0) {
    let query = supabase
      .from("documents")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("vendor_name",  extracted.vendor_name.trim())
      .eq("total_amount",    extracted.total_amount)
      .in("status",          ["reviewing", "approved", "pushed"])
      .limit(1)

    if (extracted.doc_number) {
      query = query.eq("doc_number", extracted.doc_number.trim())
    }
    if (excludeDocId) {
      query = query.neq("id", excludeDocId)
    }

    const { data } = await query
    if (data && data.length > 0) {
      is_duplicate      = true
      duplicate_doc_id  = data[0].id
      warnings.push({ code: "DUPLICATE", message: `พบเอกสารซ้ำ (id: ${data[0].id})` })
      score = Math.max(0, score - 0.3)
    }
  }

  // ── 6. Tax ID format — only for full tax invoices ────────────────────────────
  if (isTaxInvoiceFull && extracted.vendor_tax_id) {
    const taxId = extracted.vendor_tax_id.replace(/[-\s]/g, "")
    if (!/^\d{13}$/.test(taxId)) {
      warnings.push({
        code:    "INVALID_TAX_ID",
        message: "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (ต้องมี 13 หลัก)",
        field:   "vendor_tax_id",
      })
      score = Math.max(0, score - 0.05)
    }
  }

  // ── 7. Consumer-receipt specific: note if no VAT claimed ────────────────────
  if (isConsumer && !extracted.vat_claimable) {
    // Not a warning — just informational — don't deduct score
    // (already captured in business_use_note on the extracted document)
  }

  const finalScore = Math.min(1, Math.max(0, score))
  const is_valid   = finalScore >= 0.4 && !warnings.some(w => w.code === "ZERO_TOTAL")

  return {
    is_valid,
    confidence_score: finalScore,
    warnings,
    is_duplicate,
    duplicate_doc_id,
  }
}

/**
 * Auto-approve threshold.
 * Consumer/simplified receipts have a slightly lower bar (0.80) since they
 * naturally lack some fields required of full tax invoices.
 */
export const AUTO_APPROVE_THRESHOLD         = 0.85
export const AUTO_APPROVE_THRESHOLD_RECEIPT = 0.80

export function shouldAutoApprove(
  result:   ValidationResult,
  category?: string,
): boolean {
  const blockingCodes = new Set(["DUPLICATE", "ZERO_TOTAL", "TOTAL_MISMATCH"])
  const hasBlocker    = result.warnings.some(w => blockingCodes.has(w.code))
  if (hasBlocker) return false

  const isConsumer = category &&
    ["consumer_receipt", "receipt", "tax_invoice_simplified"].includes(category)

  const threshold = isConsumer
    ? AUTO_APPROVE_THRESHOLD_RECEIPT
    : AUTO_APPROVE_THRESHOLD

  return result.confidence_score >= threshold
}
