import Anthropic from "@anthropic-ai/sdk"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

let _client: Anthropic | null = null
const getClient = () => {
  if (!_client) _client = new Anthropic()  // read env at call time, not module load
  return _client
}
const MODEL     = "claude-haiku-4-5-20251001" // explicit version for caching eligibility
const MAX_PAGES = 3                            // receipts/invoices are almost always 1-2 pages

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
Analyse the document image(s) and return ONLY valid JSON — no markdown, no extra text.

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
- VAT = 7%. WHT rates: 1%, 1.5%, 3%, 5%
- For consumer_receipt: delivery_fee = ค่าจัดส่ง, discount_amount = ส่วนลด/คูปอง
- Unknown fields → null. Unknown amounts → 0
- Confidence 0.0–1.0 reflects actual certainty. Never fabricate data.`

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

// ── Main extraction function ───────────────────────────────────────────────────
/**
 * Accept PNG buffers (one per page, already preprocessed) and return
 * structured accounting data using Claude Haiku vision — no OCR step needed.
 *
 * @param pageBuffers  Preprocessed page images (JPEG)
 * @param fewShotBlock Optional few-shot examples string from fetchFewShotExamples()
 */
export async function extractDocument(
  pageBuffers: Buffer[],
  fewShotBlock = "",
): Promise<ExtractedDocument | ExtractedDocument[]> {
  // Cap to MAX_PAGES to control cost
  const pages = pageBuffers.slice(0, MAX_PAGES)

  // Build image content blocks — JPEG keeps payload ~5× smaller than PNG
  const imageBlocks: Anthropic.ImageBlockParam[] = pages.map(buf => ({
    type:   "image",
    source: {
      type:       "base64",
      media_type: "image/jpeg",
      data:       buf.toString("base64"),
    },
  }))

  const textBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: `${fewShotBlock}First, check if this image contains MORE THAN ONE separate document (e.g. multiple receipts photographed together).

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

Extract all accounting data from ${pages.length > 1 ? `these ${pages.length} document pages` : "this document"}.`,
  }

  // Use prompt caching — system prompt is identical every call, saves ~300-500ms.
  // SDK 0.24.x: cache_control is not in types → cast; beta opt-in via header not body param.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: Anthropic.Message = await (getClient().messages.create as any)(
    {
      model:      MODEL,
      max_tokens: 1200,
      system: [
        {
          type:          "text",
          text:          SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: [...imageBlocks, textBlock] }],
    },
    { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } },
  )

  const raw = (response.content as Anthropic.ContentBlock[])
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c: Anthropic.TextBlock) => c.text)
    .join("")

  // Strip markdown code fences if present
  const jsonStr = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

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

  try {
    const json = JSON.parse(jsonStr)
    // Detect multi-doc wrapper: { multi_doc: true, documents: [...] }
    if (json?.multi_doc === true && Array.isArray(json.documents)) {
      rawParsed = json.documents as RawDoc[]
    } else {
      rawParsed = json as RawDoc
    }
  } catch {
    const hint = raw.slice(0, 200).trim() || "AI ไม่สามารถประมวลผลเอกสารนี้ได้"
    rawParsed = { ...FALLBACK_DOC, extraction_issues: [`AI ตอบกลับในรูปแบบที่ไม่คาดคิด: ${hint}`] }
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
