import { createClient }            from "../lib/supabase"
import { prepareImages }           from "./preprocessor"
import { runOcrMultiPage }         from "./ocr"
import { extractDocument }         from "./extractor"
import { validateDocument, shouldAutoApprove } from "./validator"

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
 *  2. OCR via Google Document AI
 *  3. AI extraction via Claude
 *  4. Validate & duplicate-check
 *  5. Persist results to DB
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
    // ── Step 1 — Preprocess ──────────────────────────────────────────────────
    await updateProgress(documentId, "preprocessing", 10)
    const pageBuffers = await prepareImages(doc.file_path)

    // ── Step 2 — OCR ────────────────────────────────────────────────────────
    await updateProgress(documentId, "ocr", 30)
    const ocrPages = await runOcrMultiPage(pageBuffers)

    // ── Step 3 — AI Extraction ───────────────────────────────────────────────
    await updateProgress(documentId, "extracting", 55)
    const extracted = await extractDocument(ocrPages)

    // ── Step 4 — Validation ──────────────────────────────────────────────────
    await updateProgress(documentId, "validating", 75)
    const validation = await validateDocument(extracted, organizationId, documentId)

    // ── Step 5 — Persist to DB ───────────────────────────────────────────────
    await updateProgress(documentId, "saving", 90)

    const autoApprove = shouldAutoApprove(validation)
    const newStatus   = autoApprove ? "approved" : "reviewing"

    // Upsert line items (delete old + insert fresh)
    await supabase
      .from("document_line_items")
      .delete()
      .eq("document_id", documentId)

    if (extracted.line_items?.length) {
      await supabase.from("document_line_items").insert(
        extracted.line_items.map(item => ({
          document_id:  documentId,
          description:  item.description,
          quantity:     item.quantity,
          unit_price:   item.unit_price,
          amount:       item.amount,
          confidence:   item.confidence,
        }))
      )
    }

    // Update document with extracted fields
    await supabase
      .from("documents")
      .update({
        status:           newStatus,
        vendor_name:      extracted.vendor_name,
        vendor_tax_id:    extracted.vendor_tax_id,
        vendor_address:   extracted.vendor_address,
        vendor_phone:     extracted.vendor_phone,
        doc_type:         extracted.doc_type,
        doc_number:       extracted.doc_number,
        doc_date:         extracted.doc_date,
        due_date:         extracted.due_date,
        subtotal:         extracted.subtotal,
        vat_amount:       extracted.vat_amount,
        wht_amount:       extracted.wht_amount,
        total_amount:     extracted.total_amount,
        currency:         extracted.currency ?? "THB",
        payment_method:   extracted.payment_method,
        notes:            extracted.notes,
        confidence_score: validation.confidence_score,
        field_confidence: extracted.field_confidence,
        ai_raw_response:  JSON.stringify(extracted),
        extracted_at:     new Date().toISOString(),
        updated_at:       new Date().toISOString(),
        // Store validation warnings as JSON in notes extension field
        validation_warnings: validation.warnings,
        is_duplicate:        validation.is_duplicate,
        duplicate_doc_id:    validation.duplicate_doc_id ?? null,
      })
      .eq("id", documentId)

    // Audit log
    await supabase.from("document_audit_logs").insert({
      document_id: documentId,
      action:      autoApprove ? "auto_approved" : "extracted",
      actor:       "pipeline",
      metadata:    {
        confidence_score: validation.confidence_score,
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
    await setStatus(documentId, "failed", msg)
    return fail(documentId, msg)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setStatus(
  documentId: string,
  status:     string,
  errorMsg?:  string,
) {
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
