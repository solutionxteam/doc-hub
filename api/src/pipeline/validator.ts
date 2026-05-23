import { createClient } from "../lib/supabase"
import type { ExtractedDocument } from "./extractor"

const VAT_RATE = 0.07

export interface ValidationResult {
  is_valid:       boolean
  confidence_score: number          // final adjusted score
  warnings:       ValidationWarning[]
  is_duplicate:   boolean
  duplicate_doc_id?: string
}

export interface ValidationWarning {
  code:    string
  message: string
  field?:  string
}

/**
 * Validate extracted document data:
 * 1. VAT math check
 * 2. Total consistency
 * 3. Required fields
 * 4. Duplicate detection (same vendor + doc_number + amount within org)
 */
export async function validateDocument(
  extracted:       ExtractedDocument,
  organizationId:  string,
  excludeDocId?:   string,
): Promise<ValidationResult> {
  const warnings: ValidationWarning[] = []
  let score = extracted.confidence_score

  // ── 1. Required field checks ─────────────────────────────────────────────────
  if (!extracted.vendor_name?.trim()) {
    warnings.push({ code: "MISSING_VENDOR",   message: "ไม่พบชื่อผู้ขาย",       field: "vendor_name" })
    score = Math.max(0, score - 0.2)
  }
  if (!extracted.doc_number?.trim()) {
    warnings.push({ code: "MISSING_DOC_NUM",  message: "ไม่พบเลขที่เอกสาร",     field: "doc_number" })
    score = Math.max(0, score - 0.1)
  }
  if (!extracted.doc_date) {
    warnings.push({ code: "MISSING_DATE",     message: "ไม่พบวันที่เอกสาร",     field: "doc_date" })
    score = Math.max(0, score - 0.1)
  }
  if (extracted.total_amount <= 0) {
    warnings.push({ code: "ZERO_TOTAL",       message: "ยอดรวมเป็น 0 หรือไม่ถูกต้อง", field: "total_amount" })
    score = Math.max(0, score - 0.25)
  }

  // ── 2. VAT math validation ───────────────────────────────────────────────────
  if (extracted.vat_amount > 0 && extracted.subtotal > 0) {
    const expectedVat = extracted.subtotal * VAT_RATE
    const vatDiff     = Math.abs(extracted.vat_amount - expectedVat)
    const vatTolerance = Math.max(1, extracted.subtotal * 0.001)   // 0.1% tolerance, min ฿1

    if (vatDiff > vatTolerance) {
      warnings.push({
        code:    "VAT_MISMATCH",
        message: `VAT ไม่ตรงกับ 7% ของ subtotal (คาดว่า ${expectedVat.toFixed(2)}, ได้ ${extracted.vat_amount.toFixed(2)})`,
        field:   "vat_amount",
      })
      score = Math.max(0, score - 0.1)
    }
  }

  // ── 3. Total consistency check ───────────────────────────────────────────────
  if (extracted.subtotal > 0) {
    const expectedTotal = extracted.subtotal + extracted.vat_amount - extracted.wht_amount
    const totalDiff     = Math.abs(extracted.total_amount - expectedTotal)
    const tolerance     = Math.max(1, extracted.total_amount * 0.001)

    if (totalDiff > tolerance) {
      warnings.push({
        code:    "TOTAL_MISMATCH",
        message: `ยอดรวมไม่ตรงกัน: subtotal+VAT-WHT = ${expectedTotal.toFixed(2)}, ยอดที่อ่านได้ ${extracted.total_amount.toFixed(2)}`,
        field:   "total_amount",
      })
      score = Math.max(0, score - 0.15)
    }
  }

  // ── 4. Date sanity check ─────────────────────────────────────────────────────
  if (extracted.doc_date) {
    const docDate = new Date(extracted.doc_date)
    const now     = new Date()
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

  if (extracted.vendor_name && extracted.total_amount > 0) {
    const supabase = createClient()

    let query = supabase
      .from("documents")
      .select("id")
      .eq("organization_id",   organizationId)
      .ilike("vendor_name",    extracted.vendor_name.trim())
      .eq("total_amount",      extracted.total_amount)
      .in("status",            ["reviewing", "approved", "pushed"])
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
      warnings.push({
        code:    "DUPLICATE",
        message: `พบเอกสารซ้ำ (id: ${data[0].id})`,
      })
      score = Math.max(0, score - 0.3)
    }
  }

  // ── 6. Tax ID format check (Thai 13-digit) ───────────────────────────────────
  if (extracted.vendor_tax_id) {
    const taxId = extracted.vendor_tax_id.replace(/[-\s]/g, "")
    if (!/^\d{13}$/.test(taxId)) {
      warnings.push({ code: "INVALID_TAX_ID", message: "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (ต้องมี 13 หลัก)", field: "vendor_tax_id" })
      score = Math.max(0, score - 0.05)
    }
  }

  const finalScore  = Math.min(1, Math.max(0, score))
  const is_valid    = finalScore >= 0.4 && !warnings.some(w => w.code === "ZERO_TOTAL")

  return {
    is_valid,
    confidence_score: finalScore,
    warnings,
    is_duplicate,
    duplicate_doc_id,
  }
}

/**
 * Auto-approve threshold. Documents above this score and with no blocking
 * warnings are safe to approve without human review.
 */
export const AUTO_APPROVE_THRESHOLD = 0.85

export function shouldAutoApprove(result: ValidationResult): boolean {
  const blockingCodes = new Set(["DUPLICATE", "ZERO_TOTAL", "TOTAL_MISMATCH"])
  const hasBlocker    = result.warnings.some(w => blockingCodes.has(w.code))
  return !hasBlocker && result.confidence_score >= AUTO_APPROVE_THRESHOLD
}
