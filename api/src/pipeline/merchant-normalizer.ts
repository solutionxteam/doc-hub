import { createClient } from "../lib/supabase"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 *
 * Merchant Normalizer — แก้ชื่อร้านค้าที่อ่านผิดซ้ำๆ โดยเทียบกับ vendors ที่ approved แล้ว
 *
 * แนวคิด:
 *   1. ดึง vendor names ที่มีอยู่ใน org (approved documents)
 *   2. เทียบ fuzzy match กับ vendor_name ที่ extract ได้
 *   3. ถ้า similarity > threshold → ใช้ชื่อที่ถูกต้องแทน
 */

// ── Static known-brand normalization ──────────────────────────────────────────
// แก้ชื่อแบรนด์ดัง ที่มักอ่านผิด pattern เดิมซ้ำๆ
const BRAND_ALIASES: [RegExp, string][] = [
  [/\b(ปตท|ptto?r?|p\.t\.t|โออาร์|บมจ.*ปตท|บ\.ปตท)/i, "PTT"],
  [/\bshell\b|เชลล์/i, "Shell"],
  [/\b(bangchak|บางจาก)/i, "Bangchak"],
  [/\b(caltex|calte|คาลเท็กซ์)/i, "Caltex"],
  [/7.?eleven|เซเว่น|7-?11/i, "7-Eleven"],
  [/(lotus|เทสโก้|โลตัส|lotuss?)/i, "Lotus's"],
  [/(big.?c|บิ๊กซี)/i, "Big C"],
  [/(makro|แมคโคร)/i, "Makro"],
  [/(homepro|โฮมโปร)/i, "HomePro"],
  [/(global.?house|โกลบอล)/i, "Global House"],
  [/(tops?|ท็อปส์)/i, "Tops"],
  [/(villa.?market|วิลล่า)/i, "Villa Market"],
  [/(family.?mart|แฟมิลี่)/i, "Family Mart"],
  [/(grab.?food|แกร็บ)/i, "GrabFood"],
  [/(line.?man|ไลน์แมน)/i, "LINE MAN"],
  [/(shopee.?food|ช้อปปี้ฟู้ด)/i, "Shopee Food"],
  [/(foodpanda|ฟู้ดแพนด้า)/i, "foodpanda"],
  [/(robinhood|โรบินฮู้ด)/i, "Robinhood"],
  [/(starbucks|สตาร์บัคส์)/i, "Starbucks"],
  [/(amazon|คาเฟ่ อเมซอน|cafe.?amazon)/i, "Café Amazon"],
  [/(true.?coffee|ทรูคอฟฟี่)/i, "True Coffee"],
  [/(mcdonalds?|แมคโดนัลด์)/i, "McDonald's"],
  [/(kfc|เคเอฟซี)/i, "KFC"],
  [/(the.?pizza|เดอะพิซซ่า)/i, "The Pizza Company"],
  [/(minor.?food|มายเนอร์)/i, "Minor Food"],
  [/(swensen|สเวนเซ่น)/i, "Swensen's"],
  [/(mr\.?diy|มิสเตอร์ดีไอวาย)/i, "Mr. D.I.Y."],
  [/(b2s|บีทูเอส)/i, "B2S"],
  [/(officemate|ออฟฟิศเมท)/i, "OfficeMate"],
  [/(watsons?|วัตสัน)/i, "Watsons"],
  [/(boots|บูทส์)/i, "Boots"],
  [/(central|เซ็นทรัล)/i, "Central"],
  [/(the.?mall|เดอะมอลล์)/i, "The Mall"],
  [/(robinson|โรบินสัน)/i, "Robinson"],
]

/**
 * Normalize a raw vendor_name using static brand aliases first,
 * then fuzzy-match against org's approved vendors.
 *
 * Returns the normalized name (or original if no match found).
 */
export async function normalizeVendorName(
  rawName:        string,
  organizationId: string,
): Promise<string> {
  if (!rawName?.trim()) return rawName

  // ── Step 1: Static brand aliases ──────────────────────────────────────────
  for (const [pattern, canonical] of BRAND_ALIASES) {
    if (pattern.test(rawName)) return canonical
  }

  // ── Step 2: Exact lookup in vendor_correction_map (human-confirmed corrections) ──
  // ถ้า user เคยแก้ชื่อนี้มาก่อน → ใช้ชื่อที่ถูกต้องทันที
  try {
    const supabase = createClient()

    const { data: correctionMatch } = await supabase
      .from("vendor_correction_map")
      .select("correct_name")
      .eq("organization_id", organizationId)
      .ilike("raw_name", rawName.trim())
      .order("correction_count", { ascending: false })
      .limit(1)

    if (correctionMatch?.[0]?.correct_name) {
      return correctionMatch[0].correct_name
    }
  } catch { /* never block */ }

  // ── Step 3: Fuzzy match against org's known vendors ───────────────────────
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("vendors")
      .select("name")
      .eq("organization_id", organizationId)
      .order("doc_count", { ascending: false })
      .limit(50)

    if (!data?.length) return rawName

    const best = findBestMatch(rawName, data.map(v => v.name))
    if (best && best.score >= 0.75) return best.match
  } catch {
    // never block pipeline
  }

  return rawName
}

// ── Fuzzy matching (trigram similarity) ───────────────────────────────────────

function trigrams(s: string): Set<string> {
  const clean = s.toLowerCase().replace(/\s+/g, " ").trim()
  const result = new Set<string>()
  for (let i = 0; i < clean.length - 2; i++) {
    result.add(clean.slice(i, i + 3))
  }
  return result
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a.toLowerCase() === b.toLowerCase()) return 1

  const ta = trigrams(a)
  const tb = trigrams(b)
  if (ta.size === 0 || tb.size === 0) return 0

  let intersection = 0
  for (const t of ta) {
    if (tb.has(t)) intersection++
  }
  return (2 * intersection) / (ta.size + tb.size)
}

function findBestMatch(query: string, candidates: string[]): { match: string; score: number } | null {
  let best: { match: string; score: number } | null = null
  for (const candidate of candidates) {
    const score = similarity(query, candidate)
    if (!best || score > best.score) {
      best = { match: candidate, score }
    }
  }
  return best
}
