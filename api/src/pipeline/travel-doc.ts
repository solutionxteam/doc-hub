/**
 * Reading travel documents — boarding passes, hotel confirmations, rail tickets,
 * ferry bookings, car rental vouchers — into itinerary items.
 *
 * WHY THIS IS NOT THE RECEIPT EXTRACTOR
 * The receipt pipeline answers "how much was spent, on what, by whom" and its
 * output is one document with one total. A travel document answers "where will
 * you be, when" and its output is one or more STOPS ON A TIMELINE: a hotel
 * confirmation is a check-in and a check-out on different days; a return flight
 * booking is two flights a week apart. Forcing that through a schema built
 * around `total_amount` loses the part that matters.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not write to the database. It proposes items and a person accepts
 * them. Everything this session has gone wrong with has gone wrong the same
 * way — a machine-read number stored without anyone comparing it to the paper,
 * then reconciling perfectly against itself forever after. A wrong departure
 * time is cheaper than a wrong total and still ruins a morning.
 */
import Anthropic from "@anthropic-ai/sdk"
import { pdfToImages, normalizeImage } from "./preprocessor"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Sonnet 5, matching the receipt extractor (pipeline/extractor.ts MODEL_SONNET).
 *
 * Chosen by measurement rather than preference: on this project's own Thai
 * documents it took character error rate from 0.307 to 0.110 end-to-end, and
 * travel documents are the same job — small print, mixed Thai/English/Japanese,
 * numbers that must be exact. Overridable so the choice can be revisited
 * without a deploy.
 */
const MODEL = process.env.TRAVEL_DOC_MODEL ?? "claude-sonnet-5"

/** Page cap. A hotel voucher is 1–2 pages; anything longer is a booking bundle. */
const MAX_PAGES = 6

export type TravelItemType =
  | "flight" | "train" | "shinkansen" | "ferry" | "bus" | "subway"
  | "car_rental" | "taxi" | "hotel" | "restaurant" | "activity" | "other"

export interface ProposedItem {
  type: TravelItemType
  title: string
  subtitle: string | null
  /** ISO date "YYYY-MM-DD" as printed. Null when the document does not say. */
  date: string | null
  time_from: string | null
  time_to: string | null
  location: string | null
  end_location: string | null
  provider: string | null
  confirmation_code: string | null
  /** As printed, in `currency`. Never converted here. */
  amount: number | null
  currency: string | null
  /** flight_number, seat, gate, platform, car, room_type, guests, plate… */
  details: Record<string, string | number | boolean>
  notes: string | null
  /** 0–1, the model's own confidence. Treated as a hint, never as a gate. */
  confidence: number
}

export interface TravelDocResult {
  /** What the document appears to be, in the user's words. */
  document_kind: string
  items: ProposedItem[]
  /** Anything the model could not read or had to guess — shown to the user. */
  issues: string[]
  pages_read: number
}

const SYSTEM = `You read travel documents and turn them into itinerary entries.

Documents you will see: airline e-tickets and boarding passes, hotel booking
confirmations, JR/rail tickets and passes, ferry tickets, car rental vouchers,
tour and activity bookings, restaurant reservations. They may be in Thai,
English, Japanese, or a mix.

RULES

1. TRANSCRIBE, NEVER TRANSLATE OR TIDY. Write names exactly as printed,
   in the script they are printed in. "博多" stays "博多". A Thai name stays
   Thai. Do not romanise, do not correct spelling, do not expand abbreviations.

2. ONE ENTRY PER MOVEMENT OR STAY.
   - A return flight booking is TWO flight entries, on their two dates.
   - A hotel confirmation is ONE hotel entry on the CHECK-IN date, with
     check_out in details. Do not invent a second entry for checkout.
   - A rail pass valid for N days is ONE entry on its first valid date.
   - A multi-leg ticket with a connection is one entry PER LEG.

3. TIMES ARE LOCAL TO WHERE THEY HAPPEN, exactly as printed. A flight departing
   09:15 Bangkok and arriving 16:40 Fukuoka has time_from 09:15 and time_to
   16:40 — do not convert between timezones, do not compute duration.

4. DATES: return "YYYY-MM-DD". Watch the year — many tickets print only day and
   month. If the year is genuinely absent, use null and say so in issues; do NOT
   guess the current year.

5. NUMBERS ARE READ, NOT CALCULATED. Copy the printed figure. Never add a base
   fare to its taxes, never divide a total by passengers or by legs, never
   convert currency.

   When ONE printed total covers SEVERAL entries — a round-trip fare, a
   multi-night hotel, a rail pass — put the whole printed total on the FIRST
   entry and 0 on the others, then say so in issues. This keeps the trip total
   correct (the money was spent once) without inventing a per-leg price that is
   not on the document. Do NOT split it evenly: that is a calculation, and the
   two halves of a return fare are rarely equal.

6. WHEN A FIELD IS NOT PRINTED, RETURN null. An invented confirmation code is
   worse than a missing one, because someone will try to use it at a counter.

7. Put anything you are unsure about in issues, in Thai.

TYPES: flight, train, shinkansen (only for Japanese Shinkansen services:
Nozomi, Hikari, Sakura, Kodama, Mizuho, Tsubame, Hayabusa, Komachi…),
ferry, bus, subway, car_rental, taxi, hotel, restaurant, activity, other.

Reply with JSON only, no prose, no code fence:
{"document_kind": string,
 "items": [{"type": string, "title": string, "subtitle": string|null,
   "date": string|null, "time_from": string|null, "time_to": string|null,
   "location": string|null, "end_location": string|null,
   "provider": string|null, "confirmation_code": string|null,
   "amount": number|null, "currency": string|null,
   "details": object, "notes": string|null, "confidence": number}],
 "issues": [string]}`

/**
 * Turn an uploaded file into images the vision model can read.
 *
 * PDFs are rasterised because the SDK pinned in this repo (@anthropic-ai/sdk
 * 0.24.x) predates `document` content blocks — it can only send images. When
 * that dependency is upgraded, a PDF can be passed through natively and this
 * step becomes unnecessary for text-layer PDFs.
 */
async function toPages(buffer: Buffer, mimeType: string): Promise<Buffer[]> {
  if (mimeType === "application/pdf") {
    const pages = await pdfToImages(buffer)
    // pdfToImages returns the original buffer if rasterising failed. Sending a
    // PDF byte stream to a vision endpoint as though it were a JPEG produces a
    // confident description of nothing, so refuse instead.
    if (pages.length === 1 && pages[0] === buffer) {
      throw new Error(
        "แปลง PDF เป็นรูปไม่สำเร็จ — เซิร์ฟเวอร์อาจไม่มี graphicsmagick/ghostscript ติดตั้ง " +
        "ลองบันทึกเป็นรูปภาพแล้วอัปโหลดใหม่",
      )
    }
    return pages.slice(0, MAX_PAGES)
  }
  return [buffer]
}

/** Strip a ```json fence if the model added one despite being told not to. */
function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
  const start = cleaned.indexOf("{")
  const end   = cleaned.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("โมเดลไม่ได้ตอบเป็น JSON")
  return JSON.parse(cleaned.slice(start, end + 1))
}

const ALLOWED: ReadonlySet<string> = new Set<TravelItemType>([
  "flight", "train", "shinkansen", "ferry", "bus", "subway",
  "car_rental", "taxi", "hotel", "restaurant", "activity", "other",
])

const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s.length ? s : null
}
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null

/** "9:5" → "09:05"; anything unparseable → null rather than a bad time. */
function normTime(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1]), mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`
}

function normDate(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  // Reject a date the calendar does not have — "2026-02-31" round-trips
  // through Date silently as 3 March, which would file a stop on the wrong day.
  const d = new Date(`${s}T00:00:00Z`)
  return d.toISOString().slice(0, 10) === s ? s : null
}

function coerceItem(raw: unknown): ProposedItem | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const title = str(r.title)
  if (!title) return null   // an entry with no name is not usable

  const type = typeof r.type === "string" && ALLOWED.has(r.type)
    ? r.type as TravelItemType
    : "other"

  const details: Record<string, string | number | boolean> = {}
  if (r.details && typeof r.details === "object") {
    for (const [k, v] of Object.entries(r.details as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        details[k] = v
      }
    }
  }

  return {
    type, title,
    subtitle: str(r.subtitle),
    date: normDate(r.date),
    time_from: normTime(r.time_from),
    time_to:   normTime(r.time_to),
    location:  str(r.location),
    end_location: str(r.end_location),
    provider:  str(r.provider),
    confirmation_code: str(r.confirmation_code),
    amount:    num(r.amount),
    currency:  str(r.currency)?.toUpperCase() ?? null,
    details,
    notes:     str(r.notes),
    confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
  }
}

export async function readTravelDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<TravelDocResult> {
  const rawPages = await toPages(buffer, mimeType)
  // normalizeImage caps the long edge for the model's geometry and re-encodes
  // to JPEG, which also means the media_type below is always correct.
  const pages = await Promise.all(rawPages.map(p => normalizeImage(p)))

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        ...pages.map(p => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/jpeg" as const,
                    data: p.toString("base64") },
        })),
        { type: "text" as const,
          text: pages.length > 1
            ? `เอกสารนี้มี ${pages.length} หน้า — เป็นเอกสารชุดเดียวกัน อ่านรวมกันแล้วสรุปเป็นรายการเดินทาง`
            : "อ่านเอกสารนี้แล้วสรุปเป็นรายการเดินทาง" },
      ],
    }],
  })

  const block = res.content.find(b => b.type === "text")
  if (!block || block.type !== "text") throw new Error("โมเดลไม่ได้ตอบกลับเป็นข้อความ")

  const parsed = parseJson(block.text) as Record<string, unknown>
  const items = Array.isArray(parsed.items)
    ? parsed.items.map(coerceItem).filter((i): i is ProposedItem => i !== null)
    : []

  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.filter((s): s is string => typeof s === "string")
    : []

  // Surface what the coercion above threw away, rather than letting entries
  // vanish between the model and the review screen.
  const dropped = (Array.isArray(parsed.items) ? parsed.items.length : 0) - items.length
  if (dropped > 0) issues.push(`มี ${dropped} รายการที่อ่านได้ไม่ครบจนใช้ไม่ได้ และถูกตัดออก`)
  if (!items.length) issues.push("ไม่พบรายการเดินทางในเอกสารนี้ — อาจไม่ใช่เอกสารการเดินทาง")

  return {
    document_kind: str(parsed.document_kind) ?? "เอกสารการเดินทาง",
    items,
    issues,
    pages_read: pages.length,
  }
}
