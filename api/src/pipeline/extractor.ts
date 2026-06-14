import Anthropic from "@anthropic-ai/sdk"
import { runOcr }  from "./ocr"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

let _client: Anthropic | null = null
const getClient = () => {
  if (!_client) _client = new Anthropic()  // read env at call time, not module load
  return _client
}

// ── Model tiers ───────────────────────────────────────────────────────────────
// Cost: Sonnet ~฿0.91/doc, Haiku ~฿0.22/doc
// Smart routing cuts avg cost to ~฿0.43/doc (53% savings)
const MODEL_SONNET = "claude-sonnet-4-5"          // complex docs, low confidence
const MODEL_HAIKU  = "claude-haiku-4-5-20251001"  // simple receipts, high-confidence path

// Doc types that are "simple" enough for Haiku-only extraction:
//   consumer_receipt (LINE MAN, Grab), receipt (ใบเสร็จธรรมดา)
// These have predictable layouts and few fields — Haiku handles them well.
// Complex types (tax_invoice_full, receipt_with_tax, credit_note) → always Sonnet.
const HAIKU_ELIGIBLE_CATEGORIES = new Set([
  "consumer_receipt",
  "receipt",
])

// Max tokens per model pass
const MAX_TOKENS_HAIKU  = 1500   // consumer receipts don't need much
const MAX_TOKENS_SONNET = 4096   // full tax invoices can be dense
const MAX_PAGES = 3                              // receipts/invoices are almost always 1-2 pages

// ── Document category ─────────────────────────────────────────────────────────
//
//  Thai tax law classifies documents for VAT input credit as follows:
//
//  vat_claimable = true
//    tax_invoice_full      ใบกำกับภาษีเต็มรูปแบบ   — must have all 5 statutory fields
//    receipt_with_tax      ใบเสร็จรับเงิน/ใบกำกับภาษี (combined form)
//    credit_note           ใบลดหนี้                — reduces input VAT
//
//  vat_claimable = false  (can still be used as expense evidence)
//    tax_invoice_simplified  ใบกำกับภาษีอย่างย่อ   — retail (7-Eleven, Lotus, Makro …)
//    receipt                 ใบเสร็จรับเงินทั่วไป   — no VAT breakdown
//    consumer_receipt        ใบเสร็จแอป            — LINE MAN, Grab, Shopee Food …
//    invoice                 ใบแจ้งหนี้             — not yet paid / no VAT receipt
//    other                   ไม่สามารถระบุได้

export type DocCategory =
  | "tax_invoice_full"
  | "tax_invoice_simplified"
  | "receipt_with_tax"
  | "receipt"
  | "consumer_receipt"
  | "invoice"
  | "credit_note"
  | "other"

// ── Legacy doc_type mapping (keeps existing DB enum working) ──────────────────
const CATEGORY_TO_DOC_TYPE: Record<DocCategory, string> = {
  tax_invoice_full:       "tax_invoice",
  tax_invoice_simplified: "tax_invoice",
  receipt_with_tax:       "tax_invoice",
  receipt:                "receipt",
  consumer_receipt:       "receipt",
  invoice:                "invoice",
  credit_note:            "credit_note",
  other:                  "unknown",
}

// ── Business-use notes (Thai) ─────────────────────────────────────────────────
const BUSINESS_USE_NOTE: Record<DocCategory, string> = {
  tax_invoice_full:
    "ใบกำกับภาษีเต็มรูปแบบ — ใช้หักภาษีซื้อได้ และใช้เป็นหลักฐานค่าใช้จ่ายได้",
  tax_invoice_simplified:
    "ใบกำกับภาษีอย่างย่อ — ไม่สามารถใช้หักภาษีซื้อได้ แต่ใช้เป็นหลักฐานค่าใช้จ่ายได้",
  receipt_with_tax:
    "ใบเสร็จรับเงิน/ใบกำกับภาษี — ใช้หักภาษีซื้อได้ และใช้เป็นหลักฐานค่าใช้จ่ายได้",
  receipt:
    "ใบเสร็จรับเงิน — ไม่สามารถใช้หักภาษีซื้อได้ แต่ใช้เป็นหลักฐานค่าใช้จ่ายได้",
  consumer_receipt:
    "ใบเสร็จจากแอปพลิเคชัน — ไม่สามารถใช้หักภาษีซื้อได้ แต่ใช้เป็นหลักฐานค่าใช้จ่ายได้",
  invoice:
    "ใบแจ้งหนี้ — ยังไม่ได้ชำระเงิน ไม่สามารถใช้หักภาษีซื้อได้",
  credit_note:
    "ใบลดหนี้ — ใช้ลดยอดภาษีซื้อได้ตามจำนวนที่ระบุ",
  other:
    "ไม่สามารถระบุประเภทเอกสารได้ กรุณาตรวจสอบและจำแนกด้วยตนเอง",
}

const VAT_CLAIMABLE = new Set<DocCategory>([
  "tax_invoice_full",
  "receipt_with_tax",
  "credit_note",
])
const EXPENSE_CLAIMABLE = new Set<DocCategory>([
  "tax_invoice_full",
  "tax_invoice_simplified",
  "receipt_with_tax",
  "receipt",
  "consumer_receipt",
  "credit_note",
  "invoice",
])

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LineItem {
  description: string
  quantity:    number
  unit_price:  number
  amount:      number
  confidence:  number
}

export interface ExtractedDocument {
  // Classification
  doc_category:      DocCategory
  doc_type:          string           // legacy enum value for DB
  vat_claimable:     boolean
  expense_claimable: boolean
  business_use_note: string

  // Vendor / issuer
  vendor_name:       string
  vendor_tax_id:     string | null
  vendor_address:    string | null
  vendor_phone:      string | null

  // Document identifiers
  doc_number:        string | null
  doc_date:          string | null    // YYYY-MM-DD
  due_date:          string | null    // YYYY-MM-DD

  // Amounts
  subtotal:          number
  discount_amount:   number           // ส่วนลด
  delivery_fee:      number           // ค่าจัดส่ง / ค่าบริการ
  vat_amount:        number
  wht_amount:        number
  total_amount:      number
  currency:          string

  // Consumer-platform specific
  platform_name:     string | null    // "LINE MAN" | "Grab" | "Shopee Food" | …
  platform_ref:      string | null    // delivery/order ref: LMF-xxx, GrabOrder-xxx …
  customer_name:     string | null    // ชื่อลูกค้า / ผู้รับ
  staff_name:        string | null    // ชื่อพนักงาน / แคชเชียร์

  // Other
  payment_method:    string | null
  notes:             string | null
  line_items:        LineItem[]

  // Confidence
  confidence_score:  number
  field_confidence:  Record<string, number>

  // Issues reported by Claude (empty array = no issues)
  extraction_issues: string[]
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `\
You are an expert Thai accounting document parser with deep knowledge of Thai tax law.
Analyse the document image(s) and return ONLY valid JSON — absolutely no markdown code fences,
no \`\`\`json blocks, no explanatory text before or after, no comments. Just raw JSON.

## Document classification

| doc_category | Thai name | vat_claimable | Key identifier |
|---|---|---|---|
| tax_invoice_full | ใบกำกับภาษีเต็มรูปแบบ | true | Has BOTH issuer AND buyer name+address+tax ID printed |
| tax_invoice_simplified | ใบกำกับภาษีอย่างย่อ | false | Has issuer tax ID but NO buyer details |
| receipt_with_tax | ใบเสร็จรับเงิน/ใบกำกับภาษี | true | Combined form with buyer details |
| receipt | ใบเสร็จรับเงินทั่วไป | false | No VAT breakdown, no tax ID |
| consumer_receipt | ใบเสร็จจากแอปพลิเคชัน | false | Digital/app receipt |
| invoice | ใบแจ้งหนี้ | false | Bill not yet paid |
| credit_note | ใบลดหนี้ | true | Reduces previous purchase |
| other | ไม่ทราบ | false | Cannot determine |

## Critical classification rules

### tax_invoice_full requires ALL FIVE of:
1. The words "ใบกำกับภาษี" on the document
2. Issuer: name + address + 13-digit tax ID
3. Document number (เลขที่ใบกำกับภาษี)
4. Issue date
5. **Buyer: name + address** (ชื่อ/ที่อยู่ผู้ซื้อ) — THIS IS THE KEY DIFFERENTIATOR
→ If buyer name/address is missing → use tax_invoice_simplified or receipt

### Gas station bills (บิลน้ำมัน) — ALWAYS tax_invoice_simplified
Vendors: PTT, Shell, Bangchak, Esso, Caltex, OR (โออาร์), Susco, Punthai Oil, IRPC, etc.
- They print "ใบกำกับภาษีอย่างย่อ" or just the station's tax ID
- They do NOT print buyer details → never tax_invoice_full
- line_items: fuel type (Diesel/Gasohol/E20/E85/Gasoline 95/91) + liters + price/liter
- Extract: vendor_name = station brand (e.g. "PTT"), doc_number = receipt no. if visible

### Retail stores — ALWAYS tax_invoice_simplified
7-Eleven, Lotus's (เทสโก้), Makro, BigC, HomePro, Global House, B2S, OfficeMate,
Tops, Villa Market, Gourmet Market, Family Mart, Lawson, CJ Express, etc.

### Consumer-receipt platforms — ALWAYS consumer_receipt
LINE MAN (ไลน์แมน), Grab/GrabFood/GrabExpress, Shopee Food (ช้อปปี้ฟู้ด),
Robinhood (โรบินฮู้ด), FoodPanda, Bolt Food, True Food, Lazada, Shopee (shopping),
Kerry Express, Flash Express, J&T Express, SCG Express, Thailand Post (ไปรษณีย์ไทย)

For consumer_receipt documents:
- platform_ref = the unique delivery/order reference code printed on the receipt
  • LINE MAN: "LMF-YYMMDD-XXXXXXXXX" pattern (e.g. LMF-260523-562610273)
  • Grab: "GrabOrder-XXXXXX" or similar
  • Shopee/Lazada: order number printed on label
  • This field is CRITICAL for duplicate detection — extract it precisely
- customer_name = ชื่อลูกค้า / Customer field (e.g. "กบ")
- staff_name = ชื่อพนักงาน / Staff field (e.g. "น้ำ พรโภชนา")

### General receipts without tax info → receipt
Parking lots (ที่จอดรถ), toll booths (ด่านทางพิเศษ), small street vendors,
wet markets, coffee carts, hospitals (OPD receipts), etc.

## Parsing rules
- Thai Buddhist calendar: subtract 543 (e.g. "2567" → 2024, "15 ม.ค. 2566" → "2023-01-15")
- Thai month names: ม.ค./มกราคม=01, ก.พ.=02, มี.ค.=03, เม.ย.=04, พ.ค.=05, มิ.ย.=06,
  ก.ค.=07, ส.ค.=08, ก.ย.=09, ต.ค.=10, พ.ย.=11, ธ.ค.=12
- Date formats to recognize (any = YYYY-MM-DD output):
  • "02/06/2569", "2/6/69", "06-02-69" → date fields with / - separators
  • "02 มิ.ย. 2569", "2 มิถุนายน 2569" → Thai month name
  • "20250602", "250602" → compact YYYYMMDD or YYMMDD
  • Time printed next to date "12:17" is NOT the date — look for DD/MM/YYYY pattern
  • Hospital receipts: look for วันที่, Date, เวลา fields
- VAT = 7%. WHT rates: 1%, 1.5%, 3%, 5%
- For consumer_receipt: delivery_fee = ค่าจัดส่ง, discount_amount = ส่วนลด/คูปอง
- If image appears rotated, try to read text at correct orientation. Look for numbers in all directions.
- Unknown fields → null. Unknown amounts → 0
- Confidence 0.0–1.0 reflects actual certainty. Never fabricate data.

## Thai menu/line-item names — validate against real words
Thermal-printer receipts often blur Thai consonants that look alike at low resolution.
Common confusions to double-check: ท↔ก, ม↔บ, ย↔บ, ข↔ช, น↔ม, เ↔แ, ใ↔ไ, ั↔ิ, ่↔ี.
Examples of how a blurred dot-matrix print can mislead a quick read:
  "ต้มยำกุ้ง น้ำข้น" → misread as "ตับบำรุง น้ำชำน"
  "เต้าหู้ทรงเครื่อง" → misread as "เต้าหู้กรงเครื่อง"
  "กุ้งโดนัท"        → misread as "กุ้งโดนัก"
For every line_item description, ask: "is this a real Thai word/dish name?" If the
literal characters you read do NOT form a recognizable Thai word or common menu item,
re-examine the image stroke-by-stroke and pick the closest REAL Thai word that matches
the visible shapes — never output a non-word string. If still uncertain, lower that
item's confidence rather than guessing a low-confidence non-word.`

// ── Shared JSON schema string ──────────────────────────────────────────────────
const DOC_SCHEMA = `{
  "doc_category": "tax_invoice_full"|"tax_invoice_simplified"|"receipt_with_tax"|"receipt"|"consumer_receipt"|"invoice"|"credit_note"|"other",
  "vendor_name": string,
  "vendor_tax_id": string|null,
  "vendor_address": string|null,
  "vendor_phone": string|null,
  "platform_name": string|null,
  "platform_ref": string|null,
  "customer_name": string|null,
  "staff_name": string|null,
  "doc_number": string|null,
  "doc_date": "YYYY-MM-DD"|null,
  "due_date": "YYYY-MM-DD"|null,
  "subtotal": number,
  "discount_amount": number,
  "delivery_fee": number,
  "vat_amount": number,
  "wht_amount": number,
  "total_amount": number,
  "currency": "THB",
  "payment_method": string|null,
  "notes": string|null,
  "line_items": [
    { "description": string, "quantity": number, "unit_price": number, "amount": number, "confidence": number }
  ],
  "confidence_score": number,
  "field_confidence": {
    "vendor_name": number, "doc_number": number, "doc_date": number,
    "total_amount": number, "vat_amount": number, "wht_amount": number, "vendor_tax_id": number
  },
  "extraction_issues": []
}`

// ── Pre-classifier: ตัดสินใจ model tier ก่อน extraction ─────────────────────
/**
 * Quick doc-type classifier using Haiku (~0.05 วินาที, ถูกมาก).
 * Returns the likely doc_category so we can decide whether to use Haiku or Sonnet.
 * Combined with OCR pass — does both in one call to save one round-trip.
 */
interface OcrAndCategory {
  ocrText:     string
  category:    string   // doc_category guess
  useHaiku:    boolean  // true = safe to use Haiku for extraction
}

async function ocrAndClassify(imageBlocks: Anthropic.ImageBlockParam[]): Promise<OcrAndCategory> {
  try {
    const res = await getClient().messages.create({
      model:      MODEL_HAIKU,
      max_tokens: 2200,
      messages: [{
        role:    "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `Read ALL text in this Thai receipt/invoice image AND classify it.

CRITICAL — OCR errors to avoid:
- Digits: never confuse 1↔7, 3↔8, 0↔6, 6↔5 — check curves carefully
- Thai chars: น vs ม, เ vs แ, ใ vs ไ, ท vs ก, ม vs บ, ย vs บ, ข vs ช — look carefully
- Tax IDs: always 13 digits
- Dates: Buddhist year 2567=2024, 2568=2025, 2569=2026 — transcribe as-is
- Menu/item names should form REAL Thai words — if your reading produces a non-word
  (e.g. "ตับบำรุง" for what should be "ต้มยำกุ้ง"), re-examine the strokes and pick
  the real word that matches

Output in this EXACT format (two sections):
CATEGORY: <one of: tax_invoice_full|tax_invoice_simplified|receipt_with_tax|receipt|consumer_receipt|invoice|credit_note|other>
OCR:
<all visible text in order: store name, address, tax ID, doc number, date, items, amounts, payment method>`,
          },
        ],
      }],
    })

    const text = (res.content as Anthropic.ContentBlock[])
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map(c => c.text).join("").trim()

    // Parse CATEGORY: line
    const catMatch = text.match(/^CATEGORY:\s*(\S+)/m)
    const category = catMatch?.[1]?.trim() ?? "other"

    // Parse OCR section
    const ocrMatch = text.match(/^OCR:\s*\n?([\s\S]+)/m)
    const ocrText  = ocrMatch?.[1]?.trim() ?? text

    const useHaiku = HAIKU_ELIGIBLE_CATEGORIES.has(category)

    return { ocrText, category, useHaiku }
  } catch {
    return { ocrText: "", category: "other", useHaiku: false }
  }
}

// ── Pass 1: OCR — extract raw text ────────────────────────────────────────────
/**
 * First pass: read all visible text from the image using Haiku (fast + cheap).
 * Returns raw transcribed text that Pass 2 uses alongside the image.
 * Two-pass dramatically improves accuracy: Claude doesn't have to OCR + structure
 * simultaneously — it can focus on each task independently.
 */
async function ocrPass(imageBlocks: Anthropic.ImageBlockParam[]): Promise<string> {
  try {
    const res = await getClient().messages.create({
      model:      "claude-haiku-4-5-20251001",   // pinned snapshot for consistency
      max_tokens: 2048,
      messages: [{
        role:    "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `Read ALL text visible in this Thai receipt/invoice image. Transcribe every character exactly as printed.

CRITICAL — Thai thermal receipt OCR errors to avoid:
- Digits: never confuse 1↔7, 3↔8, 0↔6, 6↔5 — look carefully at curves and strokes
- Thai chars: น vs ม (different right stroke), เ vs แ (แ has extra stroke), ใ vs ไ (different left curve),
  ท vs ก, ม vs บ, ย vs บ, ข vs ช, ั vs ิ, ่ vs ี — look carefully at low-res dot-matrix shapes
- Prices: always read all digits e.g. "1,234.56" not "1,23.56" — never drop digits
- Tax IDs: always 13 digits — if you see fewer, recount
- Dates: Buddhist year 2567=2024, 2568=2025, 2569=2026 — do NOT convert, transcribe as-is
- Store names: copy exactly including ห้าง/บมจ/บจก prefixes
- Menu/item names (รายการสินค้า) should form REAL Thai words/dish names — common Thai
  thermal-printer misreads: "ต้มยำกุ้ง น้ำข้น" → "ตับบำรุง น้ำชำน", "เต้าหู้ทรงเครื่อง" → "เต้าหู้กรงเครื่อง",
  "กุ้งโดนัท" → "กุ้งโดนัก". If a transcribed item name is not a recognizable Thai word,
  re-examine the strokes and transcribe the closest real word/dish name instead.

Output sections in this order (skip if absent):
1. ชื่อร้าน/บริษัท (store/company name + branch)
2. ที่อยู่ (address)
3. เลขประจำตัวผู้เสียภาษี (tax ID — 13 digits)
4. เลขที่เอกสาร (doc number)
5. วันที่ (date as printed)
6. รายการสินค้า (line items with qty × price = amount)
7. ยอดรวม subtotal / VAT / ส่วนลด / ค่าจัดส่ง / ยอดสุทธิ
8. วิธีชำระเงิน (payment method)
9. ข้อความอื่นๆ (other visible text)

Output ONLY the transcribed text, no commentary.`,
          },
        ],
      }],
    })
    return (res.content as Anthropic.ContentBlock[])
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map(c => c.text)
      .join("")
      .trim()
  } catch {
    return ""   // if OCR pass fails, continue with image-only pass 2
  }
}

// Confidence threshold below which we trigger Google Document AI fallback
const FALLBACK_CONFIDENCE_THRESHOLD = 0.65

// ── Google Document AI fallback ────────────────────────────────────────────────
/**
 * Run Google Document AI on the first page when Claude confidence is low.
 * Adds a third source of OCR text as a "tiebreaker" — if both Haiku and DocAI
 * agree on a value that Sonnet initially got wrong, Sonnet should trust them.
 * Returns empty string if DocAI is not configured or fails.
 */
async function docAiPass(pageBuffer: Buffer): Promise<string> {
  const hasConfig = process.env.GOOGLE_DOC_AI_PROCESSOR_ID &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    process.env.GOOGLE_DOC_AI_PROCESSOR_ID !== "..."

  if (!hasConfig) return ""

  try {
    const page = await runOcr(pageBuffer)
    return page.blocks
      .filter(b => b.confidence > 0.5 && b.text.trim())
      .sort((a, b) => (b.boundingBox?.[1] ?? 0) - (a.boundingBox?.[1] ?? 0))  // top-to-bottom
      .map(b => b.text)
      .join("\n")
      .trim()
  } catch (err) {
    console.warn("[docai-fallback] failed:", (err as Error).message)
    return ""
  }
}

// ── Main extraction function ───────────────────────────────────────────────────
/**
 * Three-pass extraction (Pass 3 is conditional):
 *   Pass 1 (Haiku):         OCR — extract raw text from image
 *   Pass 2 (Sonnet):        Structure — given raw text + image, produce JSON
 *   Pass 3 (Google DocAI):  Fallback — only when confidence < 0.65; adds second OCR opinion
 *                            then re-runs Pass 2 with both OCR sources
 *
 * @param pageBuffers     Preprocessed page images (JPEG)
 * @param fewShotBlock    Few-shot + corrections + error patterns block
 * @param qualityWarnings Image quality warnings (blur, exposure) from image-quality.ts
 * @param modelTier       Plan-based AI tier: "haiku" | "smart" | "priority"
 *                        haiku    = Haiku-only (Free/Starter plans — lowest cost)
 *                        smart    = Auto-route by doc type (Pro/Team — balanced)
 *                        priority = Sonnet always (Business/Enterprise — highest accuracy)
 */
export async function extractDocument(
  pageBuffers:     Buffer[],
  fewShotBlock     = "",
  qualityWarnings: string[] = [],
  modelTier:       "haiku" | "smart" | "priority" = "smart",
): Promise<ExtractedDocument | ExtractedDocument[]> {
  const pages = pageBuffers.slice(0, MAX_PAGES)

  const imageBlocks: Anthropic.ImageBlockParam[] = pages.map(buf => ({
    type:   "image",
    source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") },
  }))

  // ── Pass 1: OCR + Classify (Haiku — cheap, fast) ────────────────────────────
  // Combined: transcribe text AND guess doc type in one call
  const { ocrText: rawOcrText, category: predictedCategory, useHaiku: autoHaiku } = await ocrAndClassify(imageBlocks)

  // Apply plan-tier override on top of auto-routing:
  //   priority → always Sonnet (ignore auto classification)
  //   haiku    → always Haiku (even for complex docs — lower-cost plans accept this trade-off)
  //   smart    → use the auto-classification result
  const useHaiku = modelTier === "priority" ? false
                 : modelTier === "haiku"    ? true
                 : autoHaiku
  console.log(`[extractor] tier=${modelTier} category=${predictedCategory} → ${useHaiku ? "Haiku" : "Sonnet"}`)

  // ── Build helpers ─────────────────────────────────────────────────────────────
  const buildOcrSection = (haikuText: string, docAiText = "") => {
    if (!haikuText && !docAiText) return ""
    const parts: string[] = []
    if (haikuText) parts.push(`### Haiku OCR:\n\`\`\`\n${haikuText}\n\`\`\``)
    if (docAiText) parts.push(`### Google Document AI OCR (second opinion):\n\`\`\`\n${docAiText}\n\`\`\``)
    return `## OCR Pre-reads (reference only — IMAGE takes priority over all OCR text)
**When OCR text and image disagree, ALWAYS trust the image.**
**When two OCR sources agree on a value, it is very likely correct.**
Common OCR errors: 1↔7, 3↔8, 0↔6 in prices/tax IDs; น↔ม, เ↔แ in Thai words.
${parts.join("\n")}

`
  }

  const qualityBlock = qualityWarnings.length
    ? qualityWarnings.join("\n") + "\n\n"
    : ""

  const buildTextBlock = (ocrSection: string): Anthropic.TextBlockParam => ({
    type: "text",
    text: `${qualityBlock}${ocrSection}${fewShotBlock}First, check if this image contains MORE THAN ONE separate document (e.g. multiple receipts photographed together).

If the image is unreadable or not a financial document, return valid JSON with confidence_score near 0 and explain in extraction_issues.

## If the image contains EXACTLY ONE document:
Return ONLY a single JSON object:
${DOC_SCHEMA}

## If the image contains MULTIPLE documents:
Return ONLY a JSON object with this wrapper:
{
  "multi_doc": true,
  "documents": [ ${DOC_SCHEMA}, ... ]
}

Cross-check ALL OCR pre-reads above against the image. When two OCR sources agree, prefer that value.
Extract all accounting data from ${pages.length > 1 ? `these ${pages.length} document pages` : "this document"}.`,
  })

  // ── Pass 2: Extraction — Haiku or Sonnet based on doc complexity ─────────────
  //
  // ROUTING LOGIC:
  //   consumer_receipt / receipt  → Haiku (predictable layout, few fields, ~฿0.22/doc)
  //   everything else             → Sonnet (complex, needs tax accuracy, ~฿0.91/doc)
  //   useHaiku + confidence < 0.7 → escalate to Sonnet automatically
  //
  const runExtraction = async (
    textBlock: Anthropic.TextBlockParam,
    model: string,
    maxTokens: number,
  ): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Anthropic.Message = await (getClient().messages.create as any)(
      {
        model,
        max_tokens: maxTokens,
        system: [
          {
            type:          "text",
            text:          SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },   // cache TTL 5 min — saves ~300ms + tokens
          },
        ],
        messages: [{ role: "user", content: [...imageBlocks, textBlock] }],
      },
      { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } },
    )
    return (response.content as Anthropic.ContentBlock[])
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c: Anthropic.TextBlock) => c.text)
      .join("")
  }

  // Alias for DocAI fallback (always Sonnet)
  const runSonnetExtraction = (textBlock: Anthropic.TextBlockParam) =>
    runExtraction(textBlock, MODEL_SONNET, MAX_TOKENS_SONNET)

  const ocrSection = buildOcrSection(rawOcrText)
  const textBlock  = buildTextBlock(ocrSection)

  // First extraction — Haiku or Sonnet
  const firstModel     = useHaiku ? MODEL_HAIKU  : MODEL_SONNET
  const firstMaxTokens = useHaiku ? MAX_TOKENS_HAIKU : MAX_TOKENS_SONNET
  const response = await runExtraction(textBlock, firstModel, firstMaxTokens)

  // ── Robust JSON extraction ────────────────────────────────────────────────────
  // Claude Sonnet sometimes adds explanatory text or markdown fences even when
  // instructed not to. We try multiple strategies in order:
  function extractJson(text: string): string {
    // Strategy 1a: full fence match ```json ... ```
    const fullFence = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i)
    if (fullFence?.[1]?.trim()) {
      const inner = fullFence[1].trim()
      if (inner.startsWith("{") || inner.startsWith("[")) return inner
    }

    // Strategy 1b: opening fence only (response truncated before closing ```)
    // e.g. response was cut off mid-JSON by max_tokens
    const openFence = text.match(/```(?:json)?\s*\n?([\s\S]+)/i)
    if (openFence?.[1]?.trim()) {
      const inner = openFence[1].replace(/```[\s\S]*$/, "").trim()
      if (inner.startsWith("{") || inner.startsWith("[")) return inner
    }

    // Strategy 2: find the first { or [ and slice to the last matching closer
    const objStart = text.indexOf("{")
    const arrStart = text.indexOf("[")
    if (objStart === -1 && arrStart === -1) return text.trim()

    const jsonStart = (objStart === -1) ? arrStart
      : (arrStart === -1) ? objStart
      : Math.min(objStart, arrStart)

    const opener  = text[jsonStart]
    const closer  = opener === "{" ? "}" : "]"
    const jsonEnd = text.lastIndexOf(closer)

    // Return whatever we found — JSON.parse will catch malformed JSON
    return jsonEnd > jsonStart
      ? text.slice(jsonStart, jsonEnd + 1).trim()
      : text.slice(jsonStart).trim()   // truncated — no closer found
  }

  // ── Parse response ────────────────────────────────────────────────────────────
  type RawDoc = Omit<ExtractedDocument, "doc_type" | "vat_claimable" | "expense_claimable" | "business_use_note">
  let rawParsed: RawDoc | RawDoc[]

  const FALLBACK_DOC: RawDoc = {
    doc_category: "other", vendor_name: "",
    vendor_tax_id: null, vendor_address: null, vendor_phone: null,
    platform_name: null, platform_ref: null, customer_name: null, staff_name: null,
    doc_number: null, doc_date: null, due_date: null,
    subtotal: 0, discount_amount: 0, delivery_fee: 0,
    vat_amount: 0, wht_amount: 0, total_amount: 0,
    currency: "THB", payment_method: null, notes: null,
    line_items: [], confidence_score: 0, field_confidence: {},
    extraction_issues: [],
  }

  const parseRaw = (text: string): RawDoc | RawDoc[] => {
    const jsonStr2 = extractJson(text)
    try {
      const json = JSON.parse(jsonStr2)
      if (json?.multi_doc === true && Array.isArray(json.documents)) return json.documents as RawDoc[]
      return json as RawDoc
    } catch {
      const hint = text.slice(0, 200).trim() || "AI ไม่สามารถประมวลผลเอกสารนี้ได้"
      return { ...FALLBACK_DOC, extraction_issues: [`AI ตอบกลับในรูปแบบที่ไม่คาดคิด: ${hint}`] }
    }
  }

  rawParsed = parseRaw(response)

  const firstConfidence = Array.isArray(rawParsed)
    ? rawParsed[0]?.confidence_score ?? 0
    : rawParsed.confidence_score ?? 0

  // ── Haiku → Sonnet escalation ─────────────────────────────────────────────────
  // If Haiku was used but result is low-confidence, automatically escalate to Sonnet.
  // Cost: adds ~฿0.69 for this doc, but beats sending user a wrong result.
  const HAIKU_ESCALATE_THRESHOLD = 0.72
  if (useHaiku && firstConfidence < HAIKU_ESCALATE_THRESHOLD) {
    console.log(`[extractor] Haiku confidence ${firstConfidence.toFixed(2)} < ${HAIKU_ESCALATE_THRESHOLD} — escalating to Sonnet`)
    const escalatedResponse = await runSonnetExtraction(buildTextBlock(ocrSection))
    const escalatedParsed   = parseRaw(escalatedResponse)
    const escalatedConf     = Array.isArray(escalatedParsed)
      ? escalatedParsed[0]?.confidence_score ?? 0
      : escalatedParsed.confidence_score ?? 0
    if (escalatedConf >= firstConfidence) {
      rawParsed = escalatedParsed
      console.log(`[extractor] Sonnet escalation: ${firstConfidence.toFixed(2)} → ${escalatedConf.toFixed(2)}`)
    }
  }

  // ── Pass 3: Google Document AI fallback ──────────────────────────────────────
  // Triggered when: overall confidence < threshold even after potential escalation,
  // OR any individual line_item is low-confidence (overall score can stay high
  // even when a couple of menu-item descriptions were misread on a thermal receipt).
  // Adds a second OCR source and re-runs Sonnet — costs ~2x but saves low-confidence docs
  const currentConfidence = Array.isArray(rawParsed)
    ? rawParsed[0]?.confidence_score ?? 0
    : rawParsed.confidence_score ?? 0

  const firstDoc = Array.isArray(rawParsed) ? rawParsed[0] : rawParsed
  const minLineItemConfidence = (firstDoc?.line_items ?? [])
    .map(item => item.confidence ?? 1)
    .reduce((min, c) => Math.min(min, c), 1)

  if (currentConfidence < FALLBACK_CONFIDENCE_THRESHOLD || minLineItemConfidence < FALLBACK_CONFIDENCE_THRESHOLD) {
    console.log(`[extractor] confidence ${currentConfidence.toFixed(2)} (min line item ${minLineItemConfidence.toFixed(2)}) — triggering Google DocAI fallback`)
    const docAiText = await docAiPass(pages[0])
    if (docAiText) {
      const retryRaw = await runSonnetExtraction(
        buildTextBlock(buildOcrSection(rawOcrText, docAiText))
      )
      const retryParsed = parseRaw(retryRaw)
      const retryFirstDoc = Array.isArray(retryParsed) ? retryParsed[0] : retryParsed
      const retryConfidence = retryFirstDoc?.confidence_score ?? 0
      const retryMinLineItemConfidence = (retryFirstDoc?.line_items ?? [])
        .map(item => item.confidence ?? 1)
        .reduce((min, c) => Math.min(min, c), 1)

      const before = Math.min(currentConfidence, minLineItemConfidence)
      const after  = Math.min(retryConfidence, retryMinLineItemConfidence)

      if (after > before) {
        console.log(`[extractor] DocAI fallback improved: ${before.toFixed(2)} → ${after.toFixed(2)}`)
        rawParsed = retryParsed
      } else {
        console.log(`[extractor] DocAI fallback did not improve (${after.toFixed(2)}) — keeping current result`)
      }
    }
  }

  // ── Normalise single or multiple documents ─────────────────────────────────
  const normalise = (parsed: RawDoc): ExtractedDocument => {
    const clamp = (v: unknown) => Math.min(1, Math.max(0, Number(v) || 0))
    parsed.confidence_score = clamp(parsed.confidence_score)
    parsed.field_confidence = Object.fromEntries(
      Object.entries(parsed.field_confidence ?? {}).map(([k, v]) => [k, clamp(v)])
    )
    for (const item of parsed.line_items ?? []) item.confidence = clamp(item.confidence)

    const toNum = (v: unknown) => { const n = Number(String(v ?? 0).replace(/,/g, "")); return isNaN(n) ? 0 : n }
    parsed.subtotal        = toNum(parsed.subtotal)
    parsed.discount_amount = toNum(parsed.discount_amount)
    parsed.delivery_fee    = toNum(parsed.delivery_fee)
    parsed.vat_amount      = toNum(parsed.vat_amount)
    parsed.wht_amount      = toNum(parsed.wht_amount)
    parsed.total_amount    = toNum(parsed.total_amount)

    // ── Math auto-correction ─────────────────────────────────────────────────
    // If total_amount exists but subtotal is missing, derive subtotal from total
    if (parsed.total_amount > 0 && parsed.subtotal === 0 && parsed.vat_amount > 0) {
      parsed.subtotal = +(parsed.total_amount - parsed.vat_amount + parsed.discount_amount).toFixed(2)
    }
    // If subtotal exists but total is missing, derive total
    if (parsed.subtotal > 0 && parsed.total_amount === 0) {
      parsed.total_amount = +(parsed.subtotal + parsed.vat_amount + parsed.delivery_fee
        - parsed.discount_amount - parsed.wht_amount).toFixed(2)
    }
    // If total and subtotal exist but VAT is missing and category implies VAT 7%
    const VAT_CAT = new Set(["tax_invoice_full","tax_invoice_simplified","receipt_with_tax","receipt"])
    if (parsed.vat_amount === 0 && parsed.total_amount > 0 && VAT_CAT.has(parsed.doc_category ?? "")) {
      // Check if total ≈ subtotal * 1.07 (VAT inclusive)
      const impliedVat = +(parsed.total_amount * 7 / 107).toFixed(2)
      const implied107 = +(parsed.total_amount / 1.07 * 0.07).toFixed(2)
      if (impliedVat > 0 && impliedVat === implied107) {
        // VAT was probably embedded — don't guess, leave at 0
      }
    }
    // Boost confidence_score if math checks out
    if (parsed.total_amount > 0 && parsed.subtotal > 0) {
      const computed = +(parsed.subtotal + parsed.vat_amount + parsed.delivery_fee
        - parsed.discount_amount - parsed.wht_amount).toFixed(2)
      const diff = Math.abs(computed - parsed.total_amount)
      const pct  = diff / parsed.total_amount
      if (pct < 0.01) {
        // Math is correct → boost confidence
        parsed.confidence_score = Math.min(1, parsed.confidence_score + 0.05)
      }
    }

    const category = (parsed.doc_category ?? "other") as DocCategory
    return {
      ...parsed,
      doc_category:      category,
      doc_type:          CATEGORY_TO_DOC_TYPE[category] ?? "unknown",
      vat_claimable:     VAT_CLAIMABLE.has(category),
      expense_claimable: EXPENSE_CLAIMABLE.has(category),
      business_use_note: BUSINESS_USE_NOTE[category],
      currency:          parsed.currency ?? "THB",
      line_items:        parsed.line_items ?? [],
      extraction_issues: parsed.extraction_issues ?? [],
    }
  }

  if (Array.isArray(rawParsed)) {
    return rawParsed.map(normalise)
  }
  return normalise(rawParsed)
}
