import { createAdminClient } from "@/lib/supabase/admin"

export const SPORT_EMOJI: Record<string, string> = {
  "แบด": "🏸", "แบดมินตัน": "🏸", "badminton": "🏸",
  "ฟุตบอล": "⚽", "football": "⚽", "soccer": "⚽", "ฟุตซอล": "⚽",
  "บาส": "🏀", "บาสเกตบอล": "🏀", "basketball": "🏀",
  "เทนนิส": "🎾", "tennis": "🎾",
  "วอลเลย์บอล": "🏐", "วอลเลย์": "🏐", "volleyball": "🏐",
  "ปิงปอง": "🏓", "table tennis": "🏓",
  "ว่ายน้ำ": "🏊", "swimming": "🏊",
  "วิ่ง": "🏃", "running": "🏃",
  "ปั่นจักรยาน": "🚴", "จักรยาน": "🚴", "cycling": "🚴",
  "กอล์ฟ": "⛳", "golf": "⛳",
}
export function sportEmoji(t: string) { return SPORT_EMOJI[(t ?? "").toLowerCase()] ?? "🏃" }

// A session's registration window closes at its end time (or start time if no
// end time) on the booking date. Sessions with no booking date never close.
export function isRegistrationClosed(bookingDate: string | null, startTime: string | null, endTime: string | null): boolean {
  if (!bookingDate) return false
  const deadline = new Date(`${bookingDate}T${endTime ?? startTime ?? "23:59"}:00`)
  return Date.now() > deadline.getTime()
}

// Resolve a LINE userId → { organization_id, user_id } via line_connections.
// Sport groups require a linked account (same as the chat /sportgroup flow) —
// this keeps creator_id/org consistent and avoids partial/orphaned connections.
export async function resolveConnection(admin: ReturnType<typeof createAdminClient>, lineUserId: string) {
  const { data } = await admin.from("line_connections")
    .select("user_id, organization_id, display_name")
    .eq("line_user_id", lineUserId)
    .maybeSingle()
  return data
}

// Each participant occupies (1 + guest_count) "seats" — the +1 guest pattern
// (e.g. "8. ฟิว +1") pays the same per-seat share as everyone else.
export async function rebalance(admin: ReturnType<typeof createAdminClient>, billId: string, totalAmount: number) {
  const { data: parts } = await admin.from("split_participants")
    .select("id, guest_count").eq("split_bill_id", billId)
  const seats = (parts ?? []).reduce((s, p: any) => s + 1 + (p.guest_count ?? 0), 0)
  if (seats > 0) {
    const share = Math.round((totalAmount / seats) * 100) / 100
    for (const p of parts!) {
      const amount = Math.round(share * (1 + ((p as any).guest_count ?? 0)) * 100) / 100
      await admin.from("split_participants").update({ amount }).eq("id", p.id)
    }
  }
  return parts?.length ?? 0
}

export const SESSION_GENERATION_WEEKS = 4

export interface SportGroupRow {
  id: string
  organization_id: string
  creator_id: string
  title: string
  sport_type: string | null
  recurring_days: number[]
  default_start_time: string | null
  default_end_time: string | null
  default_venue: string | null
  default_court_no: string | null
  default_map_url: string | null
  max_players: number | null
  line_group_id: string | null
}

/** "YYYY-MM-DD" for a Date in local time (avoids UTC-shift off-by-one) */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Generates upcoming dated sessions (split_bills rows) for a recurring
// sport_groups template, one per matching weekday in [from, from+weeksAhead*7].
// Idempotent — skips dates that already have a session for this group.
export async function generateSessions(
  admin: ReturnType<typeof createAdminClient>,
  group: SportGroupRow,
  opts: { from?: Date; weeksAhead?: number } = {},
) {
  if (!group.recurring_days?.length) return []

  const weeksAhead = opts.weeksAhead ?? SESSION_GENERATION_WEEKS
  const from = opts.from ?? new Date()
  const horizonDays = weeksAhead * 7

  const dates: string[] = []
  for (let i = 0; i <= horizonDays; i++) {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    if (group.recurring_days.includes(d.getDay())) dates.push(ymd(d))
  }
  if (dates.length === 0) return []

  const { data: existing } = await admin.from("split_bills")
    .select("booking_date")
    .eq("sport_group_id", group.id)
    .in("booking_date", dates)

  const existingDates = new Set((existing ?? []).map(b => b.booking_date as string))
  const toCreate = dates.filter(d => !existingDates.has(d))
  if (toCreate.length === 0) return []

  const title = group.default_venue ? `${group.sport_type} @ ${group.default_venue}` : group.sport_type ?? group.title

  const rows = toCreate.map(bookingDate => ({
    organization_id: group.organization_id,
    creator_id:      group.creator_id,
    document_id:     null,
    category:        "sport",
    sport_group_id:  group.id,
    sport_type:      group.sport_type,
    venue:           group.default_venue,
    title,
    total_amount:    0,
    status:          "open",
    booking_date:    bookingDate,
    start_time:      group.default_start_time,
    end_time:        group.default_end_time,
    court_no:        group.default_court_no,
    map_url:         group.default_map_url,
    max_players:     group.max_players,
    line_group_id:   group.line_group_id,
  }))

  const { data: created, error } = await admin.from("split_bills")
    .insert(rows)
    .select("id, share_token, booking_date")

  if (error || !created) return []

  // Auto-add the creator as the first participant of each new session.
  const { data: creator } = await admin.from("line_connections")
    .select("line_user_id, display_name")
    .eq("user_id", group.creator_id)
    .eq("organization_id", group.organization_id)
    .maybeSingle()

  await admin.from("split_participants").insert(
    created.map(bill => ({
      split_bill_id: bill.id,
      name:          creator?.display_name ?? "ผู้สร้างกลุ่ม",
      line_user_id:  creator?.line_user_id ?? null,
      line_display:  creator?.display_name ?? null,
      is_non_line:   !creator?.line_user_id,
      amount:        0,
      guest_count:   0,
    }))
  )

  return created
}
