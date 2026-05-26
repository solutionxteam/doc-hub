import { createClient }            from "../lib/supabase"
import { prepareImages }           from "./preprocessor"
import { extractDocument }         from "./extractor"
import type { ExtractedDocument }  from "./extractor"
import { validateDocument, shouldAutoApprove } from "./validator"
import { upsertVendor }            from "./vendor"
import { fetchFewShotExamples, formatFewShotBlock } from "./few-shot"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

export interface PipelineResult {
  success:          boolean
  documentId:       string
  confidence_score: number
  auto_approved:    boolean
  warnings:         string[]
  error?:           string
}

/**
 * Run the full extraction pipeline for a document:
 *  1. Download + convert to PNG pages
 *  2. AI vision extraction via Claude Haiku (image → JSON, no separate OCR step)
 *  3. Validate & duplicate-check
 *  4. Persist results to DB
 */
export async function runPipeline(
  documentId:     string,
  organizationId: string,
): Promise<PipelineResult> {
  const supabase = createClient()

  // ── Fetch document record ────────────────────────────────────────────────────
  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("file_path, status")
    .eq("id", documentId)
    .single()

  if (fetchErr || !doc) {
    return fail(documentId, `Document not found: ${fetchErr?.message}`)
  }
  if (doc.status === "pushed") {
    return fail(documentId, "Document already pushed — skipping re-extraction")
  }

  await setStatus(documentId, "processing")

  try {
    // ── Step 1 — Preprocess (download + convert to PNG buffers) ──────────────
    await updateProgress(documentId, "preprocessing", 10)
    const pageBuffers = await prepareImages(doc.file_path)

    // ── Step 2 — AI Vision Extraction (Claude Haiku reads images directly) ───
    //    No separate OCR step — Claude handles both reading and extraction.
    await updateProgress(documentId, "extracting", 40)

    // Inject few-shot examples so the model learns this org's naming patterns
    const fewShotExamples = await fetchFewShotExamples(organizationId)
    const fewShotBlock    = formatFewShotBlock(fewShotExamples)

    const rawExtracted = await extractDocument(pageBuffers, fewShotBlock)

    // ── Multi-document handling ──────────────────────────────────────────────
    //    When a single photo contains multiple receipts the extractor returns
    //    an array.  The first doc updates the existing record; additional docs
    //    get new sibling records (same file_path, status "reviewing").
    let extracted: ExtractedDocument
    if (Array.isArray(rawExtracted)) {
      extracted = rawExtracted[0]

      // Spin up sibling records for docs 2..N in the background
      const siblings = rawExtracted.slice(1)
      if (siblings.length > 0) {
        createSiblingDocuments(documentId, organizationId, doc.file_path, siblings).catch(err =>
          console.warn("[pipeline] sibling creation error:", err?.message)
        )
      }
    } else {
      extracted = rawExtracted
    }

    // ── Step 3 — Validation ──────────────────────────────────────────────────
    await updateProgress(documentId, "validating", 75)
    const validation = await validateDocument(extracted, organizationId, documentId)

    // ── Step 4 — Persist to DB ───────────────────────────────────────────────
    await updateProgress(documentId, "saving", 90)

    const autoApprove = shouldAutoApprove(validation, extracted.doc_category)
    const newStatus   = autoApprove ? "approved" : "reviewing"

    // Upsert line items
    await supabase.from("document_line_items").delete().eq("document_id", documentId)
    if (extracted.line_items?.length) {
      await supabase.from("document_line_items").insert(
        extracted.line_items.map((item, i) => ({
          document_id:  documentId,
          description:  item.description,
          quantity:     item.quantity,
          unit_price:   item.unit_price,
          amount:       item.amount,
          confidence:   item.confidence,
          sort_order:   i,
        }))
      )
    }

    // Update document with extracted + classification fields
    const { error: updateErr } = await supabase
      .from("documents")
      .update({
        status:            newStatus,

        // Vendor / issuer
        vendor_name:       extracted.vendor_name,
        vendor_tax_id:     extracted.vendor_tax_id,
        vendor_address:    extracted.vendor_address,
        vendor_phone:      extracted.vendor_phone,

        // Document identity
        doc_type:          extracted.doc_type,
        doc_number:        extracted.doc_number,
        doc_date:          extracted.doc_date,
        due_date:          extracted.due_date,

        // Amounts
        subtotal:          extracted.subtotal,
        discount_amount:   extracted.discount_amount,
        delivery_fee:      extracted.delivery_fee,
        vat_amount:        extracted.vat_amount,
        wht_amount:        extracted.wht_amount,
        total_amount:      extracted.total_amount,
        currency:          extracted.currency,

        // Classification & business-use
        doc_category:      extracted.doc_category,
        vat_claimable:     extracted.vat_claimable,
        expense_claimable: extracted.expense_claimable,
        business_use_note: extracted.business_use_note,
        platform_name:     extracted.platform_name,
        platform_ref:      extracted.platform_ref      || null,
        customer_name:     extracted.customer_name     || null,
        staff_name:        extracted.staff_name        || null,

        // Other
        payment_method:    extracted.payment_method,
        notes:             extracted.notes,

        // Confidence & meta
        overall_confidence: validation.confidence_score,
        confidence:         extracted.field_confidence,
        ai_raw_response:    extracted,          // jsonb — pass object, not JSON.stringify
        extracted_at:       new Date().toISOString(),
        updated_at:         new Date().toISOString(),

        // Validation + AI-reported issues
        validation_issues:   validation.warnings.map(w => w.code),
        validation_warnings: validation.warnings,
        ...(extracted.extraction_issues?.length
          ? { notes: extracted.extraction_issues.join("\n") }
          : {}),
        is_duplicate:      validation.is_duplicate,
        duplicate_of:      validation.duplicate_doc_id ?? null,
      })
      .eq("id", documentId)

    if (updateErr) {
      throw new Error(`DB update failed: ${updateErr.message} (hint: migration 007 อาจยังไม่ได้ apply)`)
    }

    // Vendor upsert — fire-and-forget, never blocks pipeline
    upsertVendor(organizationId, extracted).catch(err =>
      console.warn("[vendor] background upsert error:", err?.message)
    )

    // Audit log
    await supabase.from("document_audit_logs").insert({
      document_id: documentId,
      action:      autoApprove ? "auto_approved" : "extracted",
      actor:       "pipeline",
      metadata:    {
        confidence_score: validation.confidence_score,
        doc_category:     extracted.doc_category,
        vat_claimable:    extracted.vat_claimable,
        warnings:         validation.warnings.map(w => w.code),
        auto_approved:    autoApprove,
      },
    })

    return {
      success:          true,
      documentId,
      confidence_score: validation.confidence_score,
      auto_approved:    autoApprove,
      warnings:         validation.warnings.map(w => w.message),
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setStatus(documentId, "failed", toUserMessage(msg))
    return fail(documentId, msg)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setStatus(documentId: string, status: string, errorMsg?: string) {
  const supabase = createClient()
  await supabase
    .from("documents")
    .update({
      status,
      ...(errorMsg ? { notes: `Pipeline error: ${errorMsg}` } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
}

async function updateProgress(documentId: string, stage: string, pct: number) {
  const supabase = createClient()
  await supabase
    .from("documents")
    .update({
      processing_stage:   stage,
      processing_percent: pct,
      updated_at:         new Date().toISOString(),
    })
    .eq("id", documentId)
}

function fail(documentId: string, error: string): PipelineResult {
  return { success: false, documentId, confidence_score: 0, auto_approved: false, warnings: [], error }
}

/**
 * Create sibling document records for additional documents detected in the same image.
 * Each sibling reuses the same file_path but gets its own DB row and full pipeline run.
 */
async function createSiblingDocuments(
  sourceDocId:    string,
  organizationId: string,
  filePath:       string,
  siblings:       ExtractedDocument[],
): Promise<void> {
  const supabase = createClient()

  // Look up the source document to copy its uploader / metadata
  const { data: source } = await supabase
    .from("documents")
    .select("uploaded_by, original_name")
    .eq("id", sourceDocId)
    .single()

  for (let i = 0; i < siblings.length; i++) {
    const sib = siblings[i]

    // Create a new document row pointing at the same file
    const { data: newDoc, error } = await supabase
      .from("documents")
      .insert({
        organization_id: organizationId,
        uploaded_by:     source?.uploaded_by ?? null,
        file_path:       filePath,
        original_name:   source?.original_name
          ? `${source.original_name} (doc ${i + 2})`
          : `document (doc ${i + 2})`,
        status:          "processing",
        processing_stage:   "extracting",
        processing_percent: 40,
        created_at:      new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error || !newDoc) {
      console.warn(`[pipeline] failed to create sibling doc ${i + 2}:`, error?.message)
      continue
    }

    // Persist extracted data immediately (skip re-running extractor; we already have the data)
    const validation = await validateDocument(sib, organizationId, newDoc.id)
    const autoApprove = shouldAutoApprove(validation, sib.doc_category)

    await supabase.from("documents").update({
      status:            autoApprove ? "approved" : "reviewing",
      vendor_name:       sib.vendor_name,
      vendor_tax_id:     sib.vendor_tax_id,
      vendor_address:    sib.vendor_address,
      vendor_phone:      sib.vendor_phone,
      doc_type:          sib.doc_type,
      doc_number:        sib.doc_number,
      doc_date:          sib.doc_date,
      due_date:          sib.due_date,
      subtotal:          sib.subtotal,
      discount_amount:   sib.discount_amount,
      delivery_fee:      sib.delivery_fee,
      vat_amount:        sib.vat_amount,
      wht_amount:        sib.wht_amount,
      total_amount:      sib.total_amount,
      currency:          sib.currency,
      doc_category:      sib.doc_category,
      vat_claimable:     sib.vat_claimable,
      expense_claimable: sib.expense_claimable,
      business_use_note: sib.business_use_note,
      platform_name:     sib.platform_name,
      platform_ref:      sib.platform_ref      || null,
      customer_name:     sib.customer_name     || null,
      staff_name:        sib.staff_name        || null,
      payment_method:    sib.payment_method,
      notes:             sib.notes,
      overall_confidence: validation.confidence_score,
      confidence:         sib.field_confidence,
      ai_raw_response:    sib,
      extracted_at:       new Date().toISOString(),
      validation_issues:   validation.warnings.map(w => w.code),
      validation_warnings: validation.warnings,
      is_duplicate:      validation.is_duplicate,
      duplicate_of:      validation.duplicate_doc_id ?? null,
      processing_stage:   "saving",
      processing_percent: 90,
      updated_at:         new Date().toISOString(),
    }).eq("id", newDoc.id)

    // Upsert line items for sibling
    if (sib.line_items?.length) {
      await supabase.from("document_line_items").insert(
        sib.line_items.map((item, idx) => ({
          document_id: newDoc.id,
          description: item.description,
          quantity:    item.quantity,
          unit_price:  item.unit_price,
          amount:      item.amount,
          confidence:  item.confidence,
          sort_order:  idx,
        }))
      )
    }

    // Vendor upsert — fire-and-forget
    upsertVendor(organizationId, sib).catch(err =>
      console.warn("[vendor] sibling upsert error:", err?.message)
    )

    await supabase.from("document_audit_logs").insert({
      document_id: newDoc.id,
      action:      autoApprove ? "auto_approved" : "extracted",
      actor:       "pipeline",
      metadata:    {
        source:           "multi_doc_sibling",
        parent_doc_id:    sourceDocId,
        confidence_score: validation.confidence_score,
        doc_category:     sib.doc_category,
        auto_approved:    autoApprove,
      },
    })

    console.log(`[pipeline] sibling doc ${newDoc.id} created from ${sourceDocId} (doc ${i + 2})`)
  }
}

/** Map a technical error message to a user-friendly Thai string stored in doc.notes */
function toUserMessage(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("json") || m.includes("parse") || m.includes("unexpected token") || m.includes("syntax")) {
    return "AI ไม่สามารถอ่านข้อมูลจากเอกสารได้ — รูปภาพอาจไม่ชัดเจน หรือไม่ใช่เอกสารทางการเงิน กรุณาลองถ่ายรูปใหม่ให้ชัดและตรง"
  }
  if (m.includes("download failed") || m.includes("storage")) {
    return "ดาวน์โหลดไฟล์ไม่สำเร็จ — กรุณาลองอัปโหลดไฟล์ใหม่อีกครั้ง"
  }
  if (m.includes("rate_limit") || m.includes("overloaded") || m.includes("529")) {
    return "บริการ AI มีผู้ใช้งานหนาแน่น — กรุณาลองใหม่ในอีกสักครู่"
  }
  if (m.includes("image") || m.includes("base64") || m.includes("media_type")) {
    return "ไม่สามารถประมวลผลรูปภาพได้ — กรุณาอัปโหลดเป็นไฟล์ JPG, PNG หรือ PDF"
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return "การประมวลผลใช้เวลานานเกินไป — กรุณาลองใหม่ หรือลองส่งไฟล์ขนาดเล็กกว่านี้"
  }
  return `เกิดข้อผิดพลาดในการประมวลผล — ${msg.slice(0, 120)}`
}
