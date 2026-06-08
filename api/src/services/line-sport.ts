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
