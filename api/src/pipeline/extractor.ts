import Anthropic from "@anthropic-ai/sdk"
import type { OcrPage } from "./ocr"

const client = new Anthropic()

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LineItem {
  description: string
  quantity:    number
  unit_price:  number
  amount:      number
  confidence:  number
}

export interface ExtractedDocument {
  doc_type:         "invoice" | "receipt" | "tax_invoice" | "credit_note" | "other"
  vendor_name:      string
  vendor_tax_id:    string | null
  vendor_address:   string | null
  vendor_phone:     string | null
  doc_number:       string | null
  doc_date:         string | null   // ISO date YYYY-MM-DD
  due_date:         string | null   // ISO date YYYY-MM-DD
  subtotal:         number
  vat_amount:       number
  wht_amount:       number
  total_amount:     number
  currency:         string
  payment_method:   string | null
  notes:            string | null
  line_items:       LineItem[]
  confidence_score: number          // overall 0–1
  field_confidence: Record<string, number>
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Thai accounting document parser.
Extract structured data from OCR text of Thai tax invoices, receipts, and financial documents.
Always respond with valid JSON matching the schema exactly.
For Thai documents: VAT is typically 7%, WHT rates are 1%, 1.5%, 3%, or 5%.
Parse Thai dates (e.g. "15 มกราคม 2566" → "2023-01-15", Buddhist year is Gregorian - 543).
If a field cannot be determined, use null. Never fabricate data.
Confidence scores must reflect actual certainty (0.0–1.0).`

// ── Extraction function ────────────────────────────────────────────────────────

export async function extractDocument(pages: OcrPage[]): Promise<ExtractedDocument> {
  // Combine OCR text from all pages
  const combinedText = pages
    .map((p, i) => pages.length > 1 ? `--- Page ${i + 1} ---\n${p.text}` : p.text)
    .join("\n\n")

  // Average block confidence for context
  const allBlocks   = pages.flatMap(p => p.blocks)
  const avgOcrConf  = allBlocks.length
    ? allBlocks.reduce((s, b) => s + b.confidence, 0) / allBlocks.length
    : 0.5

  const userMessage = `Extract all accounting data from this document OCR text.
Average OCR confidence: ${(avgOcrConf * 100).toFixed(0)}%

OCR TEXT:
${combinedText}

Return ONLY a JSON object with this exact schema:
{
  "doc_type": "invoice" | "receipt" | "tax_invoice" | "credit_note" | "other",
  "vendor_name": string,
  "vendor_tax_id": string | null,
  "vendor_address": string | null,
  "vendor_phone": string | null,
  "doc_number": string | null,
  "doc_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "subtotal": number,
  "vat_amount": number,
  "wht_amount": number,
  "total_amount": number,
  "currency": "THB",
  "payment_method": string | null,
  "notes": string | null,
  "line_items": [
    {
      "description": string,
      "quantity": number,
      "unit_price": number,
      "amount": number,
      "confidence": number
    }
  ],
  "confidence_score": number,
  "field_confidence": {
    "vendor_name": number,
    "doc_number": number,
    "doc_date": number,
    "total_amount": number,
    "vat_amount": number,
    "wht_amount": number,
    "vendor_tax_id": number
  }
}`

  const response = await client.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 2048,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userMessage }],
  })

  const raw = response.content
    .filter(c => c.type === "text")
    .map(c => (c as { type: "text"; text: string }).text)
    .join("")

  // Strip markdown code fences if present
  const jsonStr = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

  const parsed = JSON.parse(jsonStr) as ExtractedDocument

  // Clamp confidence scores
  parsed.confidence_score = clamp(parsed.confidence_score)
  parsed.field_confidence  = Object.fromEntries(
    Object.entries(parsed.field_confidence ?? {}).map(([k, v]) => [k, clamp(v as number)])
  )
  for (const item of parsed.line_items ?? []) {
    item.confidence = clamp(item.confidence)
  }

  // Ensure numeric fields are numbers, not strings
  parsed.subtotal     = toNum(parsed.subtotal)
  parsed.vat_amount   = toNum(parsed.vat_amount)
  parsed.wht_amount   = toNum(parsed.wht_amount)
  parsed.total_amount = toNum(parsed.total_amount)

  return parsed
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number(v) || 0))
}

function toNum(v: unknown): number {
  const n = Number(String(v).replace(/,/g, ""))
  return isNaN(n) ? 0 : n
}
