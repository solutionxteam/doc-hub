import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const SPORT_EMOJI: Record<string, string> = {
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
function sportEmoji(t: string) { return SPORT_EMOJI[(t ?? "").toLowerCase()] ?? "🏃" }

async function rebalance(admin: ReturnType<typeof createAdminClient>, billId: string, totalAmount: number) {
  const { data: parts } = await admin.from("split_participants")
    .select("id").eq("split_bill_id", billId)
  const n = parts?.length ?? 0
  if (n > 0) {
    const share = Math.round((totalAmount / n) * 100) / 100
    for (const p of parts!) {
      await admin.from("split_participants").update({ amount: share }).eq("id", p.id)
    }
  }
  return n
}

async function loadDetail(admin: ReturnType<typeof createAdminClient>, id: string, lineUserId?: string | null) {
  const { data: bill } = await admin.from("split_bills")
    .select("id, title, sport_type, venue, total_amount, status, share_token, organization_id, creator_id, split_participants(id, name, amount, paid_at, line_user_id)")
    .eq("id", id)
    .eq("category", "sport")
    .maybeSingle()

  if (!bill) return null

  const participants = (bill.split_participants as any[])
    .map(p => ({ id: p.id, name: p.name, amount: Number(p.amount), paid: !!p.paid_at, isMe: lineUserId ? p.line_user_id === lineUserId : false }))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe))

  return {
    id:         bill.id,
    title:      bill.title,
    emoji:      sportEmoji(bill.sport_type ?? ""),
    sportType:  bill.sport_type,
    venue:      bill.venue,
    fee:        Number(bill.total_amount),
    status:     bill.status,
    shareToken: bill.share_token,
    participants,
    paidTotal:  participants.filter(p => p.paid).reduce((s, p) => s + p.amount, 0),
  }
}

// GET /api/liff/sport-groups/[id]?lineUserId=Uxxx — group detail + participants
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")
  const admin = createAdminClient()

  const detail = await loadDetail(admin, id, lineUserId)
  if (!detail) return NextResponse.json({ error: "ไม่พบกลุ่ม" }, { status: 404 })

  return NextResponse.json({ group: detail })
}

// POST /api/liff/sport-groups/[id] — actions: join | pay | unpay | finalize
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { action, lineUserId, displayName } = await req.json() as {
    action:      "join" | "pay" | "unpay" | "finalize"
    lineUserId:  string
    displayName?: string
  }
  if (!action || !lineUserId) return NextResponse.json({ error: "action and lineUserId required" }, { status: 400 })

  const admin = createAdminClient()
  const { data: bill } = await admin.from("split_bills")
    .select("id, status, total_amount, category")
    .eq("id", id).eq("category", "sport").maybeSingle()

  if (!bill) return NextResponse.json({ error: "ไม่พบกลุ่ม" }, { status: 404 })

  if (action === "join") {
    if (bill.status === "finalized") return NextResponse.json({ error: "กลุ่มนี้ปิดแล้วครับ" }, { status: 400 })
    const { data: existing } = await admin.from("split_participants")
      .select("id").eq("split_bill_id", id).eq("line_user_id", lineUserId).maybeSingle()
    if (!existing) {
      await admin.from("split_participants").insert({
        split_bill_id: id, name: displayName ?? "ผู้เข้าร่วม",
        line_user_id: lineUserId, line_display: displayName, is_non_line: false, amount: 0,
      })
      await rebalance(admin, id, Number(bill.total_amount))
    }
  }

  if (action === "pay" || action === "unpay") {
    const { data: me } = await admin.from("split_participants")
      .select("id").eq("split_bill_id", id).eq("line_user_id", lineUserId).maybeSingle()
    if (!me) return NextResponse.json({ error: "คุณยังไม่ได้เข้าร่วมกลุ่มนี้" }, { status: 400 })
    await admin.from("split_participants")
      .update({ paid_at: action === "pay" ? new Date().toISOString() : null })
      .eq("id", me.id)
  }

  if (action === "finalize") {
    if (bill.status === "finalized") return NextResponse.json({ error: "กลุ่มนี้ปิดไปแล้วครับ" }, { status: 400 })
    await rebalance(admin, id, Number(bill.total_amount))
    await admin.from("split_bills").update({ status: "finalized" }).eq("id", id)
  }

  const detail = await loadDetail(admin, id, lineUserId)
  return NextResponse.json({ ok: true, group: detail })
}
