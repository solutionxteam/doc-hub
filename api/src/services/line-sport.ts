/**
 * LINE Sport Group Service ("หารบิลกลุ่มกีฬา" — à la KhunThong)
 *
 * Handles /sportgroup, /sportjoin, /sportpay, /sportstatus, /sportdone
 *
 * Design: a "sport group" is a `split_bills` row with `document_id = NULL`
 * and `category = 'sport'`. Unlike the receipt-based /split flow (which
 * splits document line-items), a sport group splits one flat fee EVENLY
 * across however many people have joined — exactly how badminton/futsal/
 * basketball court-fee groups are split in apps like KhunThong.
 *
 * Flow:
 *   1. Someone runs /sportgroup แบด 400  → creates the group + share/LIFF link
 *   2. Friends tap the link (opens inside LINE via LIFF) → auto-join
 *   3. Anyone can run /sportstatus เพื่อดูยอดต่อหัว + ใครจ่ายแล้ว
 *   4. /sportpay marks the caller's own share as paid
 *   5. /sportdone closes the group and posts the final settle-up summary
 */
import { supabase } from "../lib/supabase"
import {
  billCreatedCard, paymentConfirmText, fullyPaidCard, reminderCard,
} from "./line-bill-cards"

const SPORT_THEME = "#5fcfb0"

const APP_URL = process.env.APP_URL ?? "https://slippy.ai"

const SPORT_EMOJI: Record<string, string> = {
  "แบด": "🏸", "แบดมินตัน": "🏸", "badminton": "🏸",
  "ฟุตบอล": "⚽", "football": "⚽", "soccer": "⚽", "ฟุตซอล": "⚽",
  "บาส": "🏀", "บาสเกตบอล": "🏀", "basketball": "🏀",
  "เทนนิส": "🎾", "tennis": "🎾",
  "ว่ายน้ำ": "🏊", "swimming": "🏊",
  "กอล์ฟ": "⛳", "golf": "⛳",
  "วอลเลย์บอล": "🏐", "volleyball": "🏐",
}

export function sportEmoji(sportType: string): string {
  return SPORT_EMOJI[sportType.toLowerCase()] ?? "🏃"
}

function fmtTHB(n: number | null | undefined): string {
  if (!n) return "฿0.00"
  return "฿" + Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function shortId(id: string): string { return id.slice(0, 8) }

// ─── Flex: sport group created — share to invite friends ─────────────────────
export function sportGroupCard(params: {
  billId: string; sportType: string; fee: number; venue?: string | null
  joinUrl: string; participantCount: number
}): object {
  const { billId, sportType, fee, venue, joinUrl, participantCount } = params
  const emoji = sportEmoji(sportType)
  const perHead = participantCount > 0 ? fee / participantCount : fee

  return {
    type: "flex",
    altText: `${emoji} สร้างกลุ่ม${sportType} — หารค่าใช้จ่ายกันเลย!`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", paddingAll: "0px",
        background: { type: "linearGradient", angle: "135deg", startColor: "#6366f1", endColor: "#4f46e5" },
        contents: [{
          type: "box", layout: "vertical", paddingAll: "18px",
          contents: [
            { type: "text", text: "🏆 สร้างกลุ่มกีฬาแล้ว", size: "xs", color: "rgba(255,255,255,0.65)", weight: "bold", letterSpacing: "2px" },
            { type: "text", text: `${emoji} ${sportType}`, size: "xl", color: "#fff", weight: "bold", margin: "xs" },
            ...(venue ? [{ type: "text", text: `📍 ${venue}`, size: "xs", color: "rgba(255,255,255,0.8)", margin: "xs" } as object] : []),
          ]
        }]
      },
      body: {
        type: "box", layout: "vertical", paddingAll: "16px", spacing: "md",
        contents: [
          {
            type: "box", layout: "horizontal",
            contents: [
              { type: "text", text: "ค่าใช้จ่ายรวม", size: "sm", color: "#6b7280" },
              { type: "text", text: fmtTHB(fee), size: "md", color: "#111827", weight: "bold", align: "end" },
            ]
          },
          {
            type: "box", layout: "horizontal",
            contents: [
              { type: "text", text: `หารตามจำนวนคน (ตอนนี้ ${participantCount} คน)`, size: "xs", color: "#9ca3af", wrap: true, flex: 5 },
              { type: "text", text: `≈ ${fmtTHB(perHead)}/คน`, size: "xs", color: "#6366f1", weight: "bold", align: "end", flex: 3 },
            ]
          },
          { type: "separator", margin: "sm" },
          { type: "text", text: "📲 แชร์ลิงก์นี้ให้เพื่อนแตะเพื่อเข้าร่วมอัตโนมัติ", size: "xs", color: "#6b7280", wrap: true, margin: "sm" },
          { type: "text", text: `รหัสกลุ่ม: ${shortId(billId)}`, size: "xxs", color: "#9ca3af", margin: "xs" },
        ]
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px", backgroundColor: "#f9fafb",
        contents: [
          { type: "button", style: "primary", height: "sm", color: "#06C755",
            action: { type: "uri", label: "🔗 ส่งลิงก์ชวนเพื่อนเข้ากลุ่ม", uri: joinUrl } },
          { type: "button", style: "primary", height: "sm", color: "#6366f1",
            action: { type: "uri", label: "🏸 เปิดแดชบอร์ดกลุ่ม (ดู/หาร/จ่าย)", uri: dashboardUrl() } },
          {
            type: "box", layout: "horizontal", spacing: "sm",
            contents: [
              { type: "button", style: "secondary", height: "sm", flex: 1,
                action: { type: "message", label: "📊 ดูสถานะ", text: `/sportstatus ${shortId(billId)}` } },
              { type: "button", style: "secondary", height: "sm", flex: 1,
                action: { type: "message", label: "✅ จ่ายแล้ว", text: `/sportpay ${shortId(billId)}` } },
            ]
          },
        ]
      }
    }
  }
}

// ─── Flex: status / final settle-up ───────────────────────────────────────────
export function sportStatusCard(params: {
  billId: string; sportType: string; fee: number; venue?: string | null
  participants: Array<{ name: string; share: number; paid: boolean }>
  joinUrl: string; done: boolean
}): object {
  const { billId, sportType, fee, venue, participants, joinUrl, done } = params
  const emoji = sportEmoji(sportType)
  const paidCount = participants.filter(p => p.paid).length

  const rows: object[] = participants.map(p => ({
    type: "box", layout: "horizontal", paddingTop: "6px",
    contents: [
      { type: "text", text: p.paid ? "✅" : "⏳", size: "sm", flex: 0 },
      { type: "text", text: p.name, size: "sm", color: "#111827", wrap: true, flex: 5, margin: "sm" },
      { type: "text", text: fmtTHB(p.share), size: "sm", color: p.paid ? "#10b981" : "#f59e0b", align: "end", flex: 3 },
    ]
  }))

  return {
    type: "flex",
    altText: `${done ? "✅ ปิดกลุ่ม" : "📊 สถานะกลุ่ม"}${sportType} — จ่ายแล้ว ${paidCount}/${participants.length}`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", paddingAll: "0px",
        background: { type: "linearGradient", angle: "135deg", startColor: done ? "#059669" : "#6366f1", endColor: done ? "#047857" : "#4f46e5" },
        contents: [{
          type: "box", layout: "vertical", paddingAll: "16px", alignItems: "center",
          contents: [
            { type: "text", text: done ? "✅ ปิดกลุ่ม — สรุปยอด" : "📊 สถานะกลุ่มกีฬา", color: "#fff", weight: "bold", size: "md" },
            { type: "text", text: `${emoji} ${sportType}${venue ? ` · 📍${venue}` : ""}`, color: "rgba(255,255,255,0.85)", size: "xs", margin: "xs" },
          ]
        }]
      },
      body: {
        type: "box", layout: "vertical", paddingAll: "14px", spacing: "none",
        contents: [
          {
            type: "box", layout: "horizontal", paddingBottom: "10px",
            contents: [
              { type: "text", text: `รวม ${fmtTHB(fee)} ÷ ${participants.length} คน`, size: "xs", color: "#6b7280", flex: 5 },
              { type: "text", text: `จ่ายแล้ว ${paidCount}/${participants.length}`, size: "xs", color: paidCount === participants.length ? "#10b981" : "#f59e0b", weight: "bold", align: "end", flex: 3 },
            ]
          },
          { type: "separator", color: "#f3f4f6" },
          ...rows,
        ]
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px", backgroundColor: "#f9fafb",
        contents: done ? [
          { type: "text", text: "🔒 กลุ่มนี้ปิดแล้ว — โอนเงินให้หัวหน้าทีมได้เลยครับ", size: "xxs", color: "#9ca3af", wrap: true, align: "center" },
          { type: "button", style: "secondary", height: "sm",
            action: { type: "uri", label: "🏸 เปิดแดชบอร์ด", uri: dashboardUrl() } },
        ] : [
          {
            type: "box", layout: "horizontal", spacing: "sm",
            contents: [
              { type: "button", style: "primary", height: "sm", flex: 1, color: "#10b981",
                action: { type: "message", label: "✅ จ่ายแล้ว", text: `/sportpay ${shortId(billId)}` } },
              { type: "button", style: "secondary", height: "sm", flex: 1,
                action: { type: "uri", label: "🔗 ชวนเพื่อน", uri: joinUrl } },
            ]
          },
          {
            type: "box", layout: "horizontal", spacing: "sm",
            contents: [
              { type: "button", style: "secondary", height: "sm", flex: 1,
                action: { type: "uri", label: "🏸 แดชบอร์ด", uri: dashboardUrl() } },
              { type: "button", style: "secondary", height: "sm", flex: 1,
                action: { type: "message", label: "🔒 ปิดกลุ่ม", text: `/sportdone ${shortId(billId)}` } },
            ]
          },
        ]
      }
    }
  }
}

// ─── KhunThong-style notification cards — thin teal (#5fcfb0) wrappers ────────
// Generic builders live in line-bill-cards.ts (shared with line-trip.ts) so the
// visual language stays identical across sport/trip groups.
export function sportBillCreatedCard(params: {
  title: string; total: number; collectorName: string
  participants: Array<{ name: string; amount: number; paid: boolean; paidAt: string | null; isCollector?: boolean }>
  payUrl: string; statusUrl?: string
}): object {
  return billCreatedCard({ ...params, themeColor: SPORT_THEME })
}

export function sportPaymentConfirmText(params: {
  title: string; payerName: string; amount: number; collectorName: string
  participants: Array<{ name: string; amount: number; paid: boolean; paidAt: string | null; isCollector?: boolean }>
}): object {
  return paymentConfirmText(params)
}

export function sportFullyPaidCard(params: {
  title: string; bookingDateLabel?: string
  participants: Array<{ name: string; amount: number; paidAt: string | null; isCollector?: boolean }>
}): object {
  const { title, bookingDateLabel, participants } = params
  return fullyPaidCard({ title, subtitle: bookingDateLabel, participants, themeColor: SPORT_THEME })
}

export function sportReminderCard(params: {
  bills: Array<{ title: string; unpaid: Array<{ name: string; amount: number }> }>
  statusUrl: string; payUrl: string
}): object {
  return reminderCard({ ...params, themeColor: SPORT_THEME })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function findGroup(billIdPrefix: string, orgId: string) {
  const { data } = await supabase
    .from("split_bills")
    .select("id, title, total_amount, sport_type, venue, status, share_token, organization_id")
    .eq("organization_id", orgId)
    .eq("category", "sport")
    .ilike("id", `${billIdPrefix}%`)
    .limit(1)
  return data?.[0] ?? null
}

function joinUrl(token: string): string {
  const liffId = process.env.LIFF_ID ?? process.env.NEXT_PUBLIC_LIFF_ID ?? ""
  const path = `/liff/join/${token}?type=split`
  return liffId ? `https://liff.line.me/${liffId}${path}` : `${APP_URL}/split/join/${token}`
}

// LIFF dashboard — list/create/manage sport groups in one place (à la KhunThong)
function dashboardUrl(): string {
  const liffId = process.env.LIFF_ID ?? process.env.NEXT_PUBLIC_LIFF_ID ?? ""
  return liffId ? `https://liff.line.me/${liffId}/liff/sport` : `${APP_URL}/liff/sport`
}

/** Recompute & persist an even split of `fee` across all current participants. */
async function rebalance(billId: string, fee: number) {
  const { data: parts } = await supabase
    .from("split_participants")
    .select("id")
    .eq("split_bill_id", billId)

  const n = parts?.length ?? 0
  if (n === 0) return
  const share = Math.round((fee / n) * 100) / 100
  for (const p of parts!) {
    await supabase.from("split_participants").update({ amount: share }).eq("id", p.id)
  }
}

// ─── /sportgroup [กีฬา] [ค่าใช้จ่าย] [สถานที่...] ──────────────────────────────
export async function handleCreateSportGroup(
  args: string[], orgId: string, lineUserId: string, displayName: string,
  lineGroupId: string | null = null,
): Promise<{ card?: object; text?: string }> {
  const sportType = args[0]
  const fee       = Number(args[1]) || 0
  const venue     = args.slice(2).join(" ").trim() || null

  if (!sportType) {
    return { text:
      "🏸 สร้างกลุ่มกีฬาแบบนี้นะครับ:\n" +
      "/sportgroup [ชนิดกีฬา] [ค่าใช้จ่ายรวม] [สถานที่]\n\n" +
      "ตัวอย่าง:\n" +
      "/sportgroup แบด 400 สนามแบดบางนา\n" +
      "/sportgroup บาส 600\n\n" +
      "ระบบจะหารค่าใช้จ่ายเท่าๆ กันให้ทุกคนที่กดเข้าร่วมลิงก์ครับ"
    }
  }

  // Resolve user's id (for creator_id FK) — line_connections.user_id
  const { data: conn } = await supabase
    .from("line_connections")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .single()

  const { data: bill, error } = await supabase
    .from("split_bills")
    .insert({
      organization_id: orgId,
      creator_id:      conn?.user_id ?? null,
      document_id:     null,
      title:           `${sportEmoji(sportType)} กลุ่ม${sportType}`,
      total_amount:    fee,
      category:        "sport",
      sport_type:      sportType,
      venue,
      status:          "open",
      line_group_id:   lineGroupId,
    })
    .select("id, share_token")
    .single()

  if (error || !bill) {
    return { text: `❌ สร้างกลุ่มไม่สำเร็จ: ${error?.message ?? "ไม่ทราบสาเหตุ"}` }
  }

  // Auto-add the creator as the first member
  await supabase.from("split_participants").insert({
    split_bill_id: bill.id,
    name:          displayName,
    line_user_id:  lineUserId,
    line_display:  displayName,
    amount:        fee, // sole member for now — will be rebalanced as people join
  })

  return {
    card: sportGroupCard({
      billId:           bill.id,
      sportType,
      fee,
      venue,
      joinUrl:          joinUrl(bill.share_token),
      participantCount: 1,
    })
  }
}

// ─── /sportstatus or /sportdone [รหัสกลุ่ม] ───────────────────────────────────
export async function handleSportStatus(
  billIdPrefix: string, orgId: string, finalize: boolean,
): Promise<{ card?: object; text?: string }> {
  const bill = await findGroup(billIdPrefix, orgId)
  if (!bill) return { text: "❌ ไม่พบกลุ่มกีฬานี้ครับ ลองเช็ครหัสจาก /sportgroup อีกครั้ง" }

  await rebalance(bill.id, Number(bill.total_amount ?? 0))

  const { data: parts } = await supabase
    .from("split_participants")
    .select("name, amount, paid_at")
    .eq("split_bill_id", bill.id)
    .order("created_at")

  const participants = (parts ?? []).map(p => ({
    name:  p.name as string,
    share: Number(p.amount ?? 0),
    paid:  !!p.paid_at,
  }))

  if (finalize) {
    await supabase.from("split_bills").update({ status: "finalized" }).eq("id", bill.id)
  }

  return {
    card: sportStatusCard({
      billId:       bill.id,
      sportType:    bill.sport_type ?? "กีฬา",
      fee:          Number(bill.total_amount ?? 0),
      venue:        bill.venue,
      participants,
      joinUrl:      joinUrl(bill.share_token),
      done:         finalize || bill.status === "finalized",
    })
  }
}

// A session's registration window closes at its end time (or start time if no
// end time) on the booking date. Sessions with no booking date never close.
function isRegistrationClosed(bookingDate: string | null, startTime: string | null, endTime: string | null): boolean {
  if (!bookingDate) return false
  const deadline = new Date(`${bookingDate}T${endTime ?? startTime ?? "23:59"}:00`)
  return Date.now() > deadline.getTime()
}

// ─── Invite Flex card (server-side equivalent of the LIFF's buildInviteFlex) ──
// Sent into the LINE group right after it's linked, so members can immediately
// join/leave the upcoming session via postback buttons.
export async function buildSportInviteFlex(bill: {
  id: string; title: string; sport_type: string | null; total_amount: number | null
  venue: string | null; booking_date: string | null; start_time: string | null; end_time: string | null
  share_token: string
}): Promise<object> {
  const { count } = await supabase
    .from("split_participants")
    .select("id", { count: "exact", head: true })
    .eq("split_bill_id", bill.id)

  const n = count || 1
  const fee = Number(bill.total_amount ?? 0)
  const perPerson = Math.round((fee / n) * 100) / 100
  const emoji = sportEmoji(bill.sport_type ?? "")

  const rows: object[] = []
  if (bill.booking_date) {
    rows.push({ type: "box", layout: "baseline", spacing: "sm", contents: [
      { type: "text", text: "📅", flex: 0, size: "sm" },
      { type: "text", text: bill.booking_date, size: "sm", color: "#555555", margin: "md", wrap: true },
    ] })
  }
  if (bill.start_time) {
    rows.push({ type: "box", layout: "baseline", spacing: "sm", contents: [
      { type: "text", text: "⏰", flex: 0, size: "sm" },
      { type: "text", text: `${bill.start_time}${bill.end_time ? ` - ${bill.end_time}` : ""}`, size: "sm", color: "#555555", margin: "md", wrap: true },
    ] })
  }
  if (bill.venue) {
    rows.push({ type: "box", layout: "baseline", spacing: "sm", contents: [
      { type: "text", text: "📍", flex: 0, size: "sm" },
      { type: "text", text: bill.venue, size: "sm", color: "#555555", margin: "md", wrap: true },
    ] })
  }
  rows.push({ type: "box", layout: "baseline", spacing: "sm", contents: [
    { type: "text", text: "💰", flex: 0, size: "sm" },
    { type: "text", text: `${fmtTHB(perPerson)} / คน  (รวม ${fmtTHB(fee)})`, size: "sm", color: "#555555", margin: "md", wrap: true },
  ] })

  return {
    type: "flex",
    altText: `${emoji} ชวนเล่น ${bill.title} — ${fmtTHB(perPerson)}/คน`,
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: `${emoji} ${bill.title}`, weight: "bold", size: "lg", wrap: true },
          { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: rows },
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          {
            type: "box", layout: "horizontal", spacing: "sm",
            contents: [
              { type: "button", style: "primary", color: "#7c3aed", height: "sm", flex: 1,
                action: { type: "postback", label: "🙋 เข้าร่วม", data: `sport:join:${bill.id}`, displayText: "🙋 เข้าร่วม" } },
              { type: "button", style: "secondary", height: "sm", flex: 1,
                action: { type: "postback", label: "❌ ยกเลิก", data: `sport:leave:${bill.id}`, displayText: "❌ ยกเลิกเข้าร่วม" } },
            ],
          },
          { type: "button", style: "link", height: "sm",
            action: { type: "uri", label: "📋 ดูรายละเอียด", uri: joinUrl(bill.share_token) } },
        ],
      },
    },
  }
}

// ─── Formats the current participant list for "เข้าร่วม/ยกเลิก" replies ───────
async function participantListText(billId: string): Promise<string> {
  const { data: parts } = await supabase
    .from("split_participants")
    .select("name")
    .eq("split_bill_id", billId)
    .order("created_at")

  const names = (parts ?? []).map(p => p.name as string)
  if (names.length === 0) return "👥 ยังไม่มีผู้เข้าร่วมครับ"
  return `👥 รายชื่อผู้เข้าร่วม (${names.length} คน):\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}`
}

// ─── In-chat join/leave via postback buttons on the invite card ──────────────
export async function handleSportToggle(
  billId: string, action: "join" | "leave", lineUserId: string, displayName: string,
): Promise<{ text?: string }> {
  const { data: bill } = await supabase
    .from("split_bills")
    .select("id, sport_type, total_amount, status, booking_date, start_time, end_time")
    .eq("id", billId).eq("category", "sport")
    .maybeSingle()

  if (!bill) return { text: "❌ ไม่พบกลุ่มนี้ครับ (อาจถูกลบไปแล้ว)" }
  if (bill.status === "finalized") return { text: "🔒 กลุ่มนี้ปิดแล้วครับ" }

  const { data: existing } = await supabase
    .from("split_participants")
    .select("id")
    .eq("split_bill_id", billId).eq("line_user_id", lineUserId)
    .maybeSingle()

  const emoji = sportEmoji(bill.sport_type ?? "")

  if (action === "join") {
    if (existing) return { text: `✅ ${displayName} เข้าร่วมอยู่แล้วครับ` }
    if (isRegistrationClosed(bill.booking_date, bill.start_time, bill.end_time)) {
      return { text: "⏰ เกินกำหนดการลงทะเบียนแล้วครับ" }
    }
    await supabase.from("split_participants").insert({
      split_bill_id: billId, name: displayName, line_user_id: lineUserId,
      line_display: displayName, is_non_line: false, amount: 0,
    })
    await rebalance(billId, Number(bill.total_amount ?? 0))
    const list = await participantListText(billId)
    return { text: `🙋 ${displayName} เข้าร่วม${emoji}${bill.sport_type ?? "กิจกรรม"}แล้วครับ!\n\n${list}` }
  }

  // action === "leave"
  if (!existing) return { text: `${displayName} ยังไม่ได้เข้าร่วมกลุ่มนี้ครับ` }
  await supabase.from("split_participants").delete().eq("id", existing.id)
  await rebalance(billId, Number(bill.total_amount ?? 0))
  const list = await participantListText(billId)
  return { text: `👋 ${displayName} ยกเลิกการเข้าร่วมแล้วครับ\n\n${list}` }
}

// ─── Link a sport group/session to the LINE group chat it was shared into ────
// Triggered by the "📌 ตั้งเป็นกลุ่มหลัก" postback button — only the chat that
// actually taps the button reveals its group/room ID (shareTargetPicker never
// returns the picked chat's ID to the LIFF), so this is the only reliable way
// to capture it.
export async function handleSetLineGroup(
  targetType: "g" | "s", id: string, lineGroupId: string,
): Promise<{ text?: string; card?: object }> {
  if (targetType === "g") {
    const { data: group } = await supabase.from("sport_groups")
      .update({ line_group_id: lineGroupId })
      .eq("id", id)
      .select("title")
      .maybeSingle()
    if (!group) return { text: "❌ ไม่พบกลุ่มนี้ครับ" }

    // Propagate to upcoming sessions that haven't been individually overridden
    await supabase.from("split_bills")
      .update({ line_group_id: lineGroupId })
      .eq("sport_group_id", id)
      .is("line_group_id", null)
      .neq("status", "finalized")

    // Send the upcoming session's invite card right away so members can
    // join/leave straight from the now-linked group.
    const { data: session } = await supabase.from("split_bills")
      .select("id, title, sport_type, total_amount, venue, booking_date, start_time, end_time, share_token, status")
      .eq("sport_group_id", id).eq("status", "open")
      .order("booking_date", { ascending: true })
      .limit(1).maybeSingle()

    const card = session ? await buildSportInviteFlex(session) : undefined
    return { text: `✅ ตั้งกลุ่มแชทนี้เป็นกลุ่มหลักของ "${group.title}" แล้วครับ — การ์ดเชิญและแจ้งเตือนของนัดต่อๆไปจะส่งมาที่นี่อัตโนมัติ`, card }
  }

  const { data: bill } = await supabase.from("split_bills")
    .update({ line_group_id: lineGroupId })
    .eq("id", id)
    .select("id, title, sport_type, total_amount, venue, booking_date, start_time, end_time, share_token, status")
    .maybeSingle()
  if (!bill) return { text: "❌ ไม่พบกลุ่มนี้ครับ" }

  const card = bill.status === "open" ? await buildSportInviteFlex(bill) : undefined
  return { text: `✅ ตั้งกลุ่มแชทนี้เป็นกลุ่มหลักของ "${bill.title}" แล้วครับ`, card }
}

// ─── /linkgroup <code> — link the chat this command is sent from as the
// "main" LINE group for a sport group/session, looked up by share_token.
// Sent as a plain text command (works reliably in groups the bot has joined,
// unlike shareTargetPicker which can't confirm delivery back to the LIFF).
// ─── /linkgroup (no code) — bot replies in this chat with a pick-list of the
// org's recent sport groups/sessions. Tapping one fires a postback from the
// bot's OWN message, so event.source.groupId/roomId is reliably this chat's id.
export async function handleLinkGroupList(
  orgId: string,
): Promise<{ card?: object; text?: string }> {
  const { data: groups } = await supabase.from("sport_groups")
    .select("id, title, sport_type")
    .eq("organization_id", orgId).eq("status", "active")
    .order("created_at", { ascending: false }).limit(5)

  const { data: bills } = await supabase.from("split_bills")
    .select("id, title, sport_type")
    .eq("organization_id", orgId).eq("category", "sport")
    .is("sport_group_id", null).eq("status", "open")
    .order("created_at", { ascending: false }).limit(5)

  const items = [
    ...(groups ?? []).map(g => ({ targetType: "g" as const, id: g.id, title: g.title, emoji: sportEmoji(g.sport_type ?? "") })),
    ...(bills ?? []).map(b => ({ targetType: "s" as const, id: b.id, title: b.title, emoji: sportEmoji(b.sport_type ?? "") })),
  ].slice(0, 8)

  if (items.length === 0) {
    return { text: "❌ ไม่พบกลุ่มกีฬาในองค์กรนี้ครับ — สร้างกลุ่มก่อนจากหน้า LIFF แล้วลองใหม่" }
  }

  return {
    card: {
      type: "flex",
      altText: "🔗 เลือกกลุ่มกีฬาที่จะเชื่อมกับแชทนี้",
      contents: {
        type: "bubble",
        body: {
          type: "box", layout: "vertical", spacing: "md",
          contents: [
            { type: "text", text: "🔗 เชื่อมกลุ่ม LINE", weight: "bold", size: "lg" },
            { type: "text", text: "เลือกกลุ่ม/นัดที่จะตั้งแชทนี้เป็นกลุ่มหลัก — การ์ดเชิญและแจ้งเตือนจะส่งมาที่นี่อัตโนมัติ", size: "sm", color: "#555555", wrap: true, margin: "md" },
            { type: "separator", margin: "md" },
            ...items.map(it => ({
              type: "button", style: "secondary", height: "sm", margin: "sm",
              action: { type: "postback", label: `${it.emoji} ${it.title}`.slice(0, 40), data: `sport:linkgroupask:${it.targetType}:${it.id}`, displayText: `เลือก: ${it.title}` },
            })),
          ],
        },
      },
    },
  }
}

// ─── Confirmation step before linking — shows "อนุญาต / ปฏิเสธ" buttons,
// same pattern as the document approve/reject card. Tapping "อนุญาต" fires
// sport:linkgroupyes (does the actual link); "ปฏิเสธ" fires sport:linkgroupno.
export async function handleLinkGroupAsk(
  targetType: "g" | "s", id: string,
): Promise<{ card?: object; text?: string }> {
  const table = targetType === "g" ? "sport_groups" : "split_bills"
  const { data: row } = await supabase.from(table)
    .select("title").eq("id", id).maybeSingle()
  if (!row) return { text: "❌ ไม่พบรายการนี้ครับ" }

  return {
    card: {
      type: "flex",
      altText: `ยืนยันเชื่อมกลุ่มแชทนี้กับ "${row.title}"?`,
      contents: {
        type: "bubble",
        body: {
          type: "box", layout: "vertical", spacing: "md",
          contents: [
            { type: "text", text: "🔗 ยืนยันการเชื่อมกลุ่ม", weight: "bold", size: "lg" },
            { type: "text", text: `ต้องการตั้งแชทนี้เป็นกลุ่มหลักของ "${row.title}" ใช่หรือไม่?\nการ์ดเชิญและแจ้งเตือนของนัดต่อๆไปจะส่งมาที่นี่อัตโนมัติ`, size: "sm", color: "#555555", wrap: true, margin: "md" },
            { type: "separator", margin: "md" },
            {
              type: "box", layout: "horizontal", spacing: "sm", margin: "md",
              contents: [
                { type: "button", style: "primary", height: "sm", flex: 1, color: "#10b981",
                  action: { type: "postback", label: "✓ อนุญาต", data: `sport:linkgroupyes:${targetType}:${id}`, displayText: "✓ อนุญาต" } },
                { type: "button", style: "primary", height: "sm", flex: 1, color: "#ef4444",
                  action: { type: "postback", label: "✕ ปฏิเสธ", data: "sport:linkgroupno", displayText: "✕ ปฏิเสธ" } },
              ]
            },
          ],
        },
      },
    },
  }
}

export async function handleLinkGroupCommand(
  shareToken: string, lineGroupId: string,
): Promise<{ text?: string; card?: object }> {
  const { data: group } = await supabase.from("sport_groups")
    .select("id").eq("share_token", shareToken).maybeSingle()
  if (group) return handleSetLineGroup("g", group.id, lineGroupId)

  const { data: bill } = await supabase.from("split_bills")
    .select("id").eq("share_token", shareToken).eq("category", "sport").maybeSingle()
  if (bill) return handleSetLineGroup("s", bill.id, lineGroupId)

  return { text: "❌ ไม่พบรายการที่ตรงกับโค้ดนี้ครับ — ตรวจสอบโค้ดอีกครั้ง" }
}

// ─── /sportinvite <code> — post the session's invite/join card into this chat.
// Sent as a plain text command via shareTargetPicker (same reliable pattern as
// /linkgroup) — the picked chat receives the text, the bot replies in that
// chat (event.source.groupId is reliable here), so the Flex card lands there.
export async function handleSportInviteCommand(
  shareToken: string,
): Promise<{ text?: string; card?: object }> {
  const sessionCols = "id, title, sport_type, total_amount, venue, booking_date, start_time, end_time, share_token, status, sport_group_id"

  const { data: group } = await supabase.from("sport_groups")
    .select("id").eq("share_token", shareToken).maybeSingle()

  let bill: any = null
  if (group) {
    const { data } = await supabase.from("split_bills")
      .select(sessionCols)
      .eq("sport_group_id", group.id).eq("status", "open")
      .order("booking_date", { ascending: true })
      .limit(1).maybeSingle()
    bill = data
  } else {
    const { data } = await supabase.from("split_bills")
      .select(sessionCols)
      .eq("share_token", shareToken).eq("category", "sport")
      .maybeSingle()
    bill = data
  }

  if (!bill) return { text: "❌ ไม่พบนัดที่จะเชิญครับ — อาจยังไม่มีนัดที่เปิดอยู่" }
  if (bill.status !== "open") return { text: "🔒 นัดนี้ปิดแล้วครับ" }

  return { card: await buildSportInviteFlex(bill) }
}

// ─── /sportpay [รหัสกลุ่ม] — mark caller's own share as paid ──────────────────
export async function handleSportPay(
  billIdPrefix: string, orgId: string, lineUserId: string, displayName: string,
): Promise<{ card?: object; text?: string }> {
  const bill = await findGroup(billIdPrefix, orgId)
  if (!bill) return { text: "❌ ไม่พบกลุ่มกีฬานี้ครับ" }
  if (bill.status === "finalized") return { text: "🔒 กลุ่มนี้ปิดแล้วครับ ดูยอดสุดท้ายได้ด้วย /sportstatus " + shortId(bill.id) }

  // Ensure caller is a participant (auto-join if they paid before tapping the link)
  const { data: existing } = await supabase
    .from("split_participants")
    .select("id")
    .eq("split_bill_id", bill.id).eq("line_user_id", lineUserId)
    .maybeSingle()

  let participantId = existing?.id
  if (!participantId) {
    const { data: created } = await supabase.from("split_participants").insert({
      split_bill_id: bill.id, name: displayName, line_user_id: lineUserId,
      line_display: displayName, amount: 0,
    }).select("id").single()
    participantId = created?.id
  }

  if (participantId) {
    await supabase.from("split_participants")
      .update({ paid_at: new Date().toISOString() })
      .eq("id", participantId)
  }

  return handleSportStatus(shortId(bill.id), orgId, false)
}
