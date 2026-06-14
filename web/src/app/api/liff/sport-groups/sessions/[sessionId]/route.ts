import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sportEmoji, rebalance, resolveConnection, isRegistrationClosed } from "../../_lib"

// Fire-and-forget call to api/sport/notify — pushes pay/unpay/finalize update
// cards back into the LINE group chat where the sport group was created.
// No-op server-side if the bill has no line_group_id (LIFF-only group).
function notifySportGroup(billId: string, event: "pay" | "unpay" | "finalize", lineUserId: string) {
  if (!process.env.API_BASE_URL || !process.env.INTERNAL_API_KEY) return
  fetch(`${process.env.API_BASE_URL}/sport/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY },
    body: JSON.stringify({ billId, event, lineUserId }),
  }).catch(err => console.error("[sport-notify] failed:", err.message))
}

export async function loadDetail(admin: ReturnType<typeof createAdminClient>, id: string, lineUserId?: string | null) {
  const { data: bill } = await admin.from("split_bills")
    .select("id, title, sport_type, venue, total_amount, status, share_token, organization_id, creator_id, booking_date, start_time, end_time, court_no, map_url, max_players, sport_group_id, line_group_id, split_participants(id, name, amount, paid_at, line_user_id, guest_count, payment_proof_url)")
    .eq("id", id)
    .eq("category", "sport")
    .maybeSingle()

  if (!bill) return null

  let groupTitle: string | null = null
  if (bill.sport_group_id) {
    const { data: group } = await admin.from("sport_groups")
      .select("title").eq("id", bill.sport_group_id).maybeSingle()
    groupTitle = group?.title ?? null
  }

  const { data: expenseRows } = await admin.from("session_expenses")
    .select("id, category, label, amount, created_at")
    .eq("split_bill_id", id)
    .order("created_at", { ascending: true })

  const expenses = (expenseRows ?? []).map(e => ({
    id: e.id, category: e.category, label: e.label, amount: Number(e.amount),
  }))
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0)

  const participants = (bill.split_participants as any[])
    .map(p => ({
      id: p.id, name: p.name, amount: Number(p.amount), paid: !!p.paid_at,
      isMe: lineUserId ? p.line_user_id === lineUserId : false,
      guestCount: p.guest_count ?? 0,
      paymentProofUrl: p.payment_proof_url ?? null,
    }))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe))

  return {
    id:          bill.id,
    title:       bill.title,
    emoji:       sportEmoji(bill.sport_type ?? ""),
    sportType:   bill.sport_type,
    venue:       bill.venue,
    fee:         Number(bill.total_amount),
    status:      bill.status,
    shareToken:  bill.share_token,
    bookingDate: bill.booking_date,
    startTime:   bill.start_time,
    endTime:     bill.end_time,
    courtNo:     bill.court_no,
    mapUrl:      bill.map_url,
    maxPlayers:  bill.max_players,
    sportGroupId: bill.sport_group_id,
    lineGroupId: bill.line_group_id,
    groupTitle,
    participants,
    paidTotal:  participants.filter(p => p.paid).reduce((s, p) => s + p.amount, 0),
    expenses,
    expensesTotal,
  }
}

// GET /api/liff/sport-groups/sessions/[sessionId]?lineUserId=Uxxx — session detail + participants
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")
  const admin = createAdminClient()

  const detail = await loadDetail(admin, sessionId, lineUserId)
  if (!detail) return NextResponse.json({ error: "ไม่พบกลุ่ม" }, { status: 404 })

  return NextResponse.json({ group: detail })
}

// POST /api/liff/sport-groups/sessions/[sessionId] — actions: join | pay | unpay | finalize | setGuests
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const { action, lineUserId, displayName, guestCount } = await req.json() as {
    action:      "join" | "pay" | "unpay" | "finalize" | "setGuests"
    lineUserId:  string
    displayName?: string
    guestCount?:  number
  }
  if (!action || !lineUserId) return NextResponse.json({ error: "action and lineUserId required" }, { status: 400 })

  const admin = createAdminClient()
  const { data: bill } = await admin.from("split_bills")
    .select("id, status, total_amount, category, booking_date, start_time, end_time")
    .eq("id", sessionId).eq("category", "sport").maybeSingle()

  if (!bill) return NextResponse.json({ error: "ไม่พบกลุ่ม" }, { status: 404 })

  if (action === "join") {
    if (bill.status === "finalized") return NextResponse.json({ error: "กลุ่มนี้ปิดแล้วครับ" }, { status: 400 })
    if (isRegistrationClosed(bill.booking_date, bill.start_time, bill.end_time)) {
      return NextResponse.json({ error: "เกินกำหนดการลงทะเบียนแล้วครับ" }, { status: 400 })
    }
    const { data: existing } = await admin.from("split_participants")
      .select("id").eq("split_bill_id", sessionId).eq("line_user_id", lineUserId).maybeSingle()
    if (!existing) {
      await admin.from("split_participants").insert({
        split_bill_id: sessionId, name: displayName ?? "ผู้เข้าร่วม",
        line_user_id: lineUserId, line_display: displayName, is_non_line: false, amount: 0,
        guest_count: Math.max(0, Math.min(guestCount ?? 0, 5)),
      })
      await rebalance(admin, sessionId, Number(bill.total_amount))
    }
  }

  // Update my own "+1" guest count (e.g. "8. ฟิว +1")
  if (action === "setGuests") {
    if (bill.status === "finalized") return NextResponse.json({ error: "กลุ่มนี้ปิดแล้วครับ" }, { status: 400 })
    const { data: me } = await admin.from("split_participants")
      .select("id").eq("split_bill_id", sessionId).eq("line_user_id", lineUserId).maybeSingle()
    if (!me) return NextResponse.json({ error: "คุณยังไม่ได้เข้าร่วมกลุ่มนี้" }, { status: 400 })
    await admin.from("split_participants")
      .update({ guest_count: Math.max(0, Math.min(guestCount ?? 0, 5)) })
      .eq("id", me.id)
    await rebalance(admin, sessionId, Number(bill.total_amount))
  }

  if (action === "pay" || action === "unpay") {
    const { data: me } = await admin.from("split_participants")
      .select("id").eq("split_bill_id", sessionId).eq("line_user_id", lineUserId).maybeSingle()
    if (!me) return NextResponse.json({ error: "คุณยังไม่ได้เข้าร่วมกลุ่มนี้" }, { status: 400 })
    await admin.from("split_participants")
      .update({ paid_at: action === "pay" ? new Date().toISOString() : null })
      .eq("id", me.id)
  }

  if (action === "finalize") {
    if (bill.status === "finalized") return NextResponse.json({ error: "กลุ่มนี้ปิดไปแล้วครับ" }, { status: 400 })
    await rebalance(admin, sessionId, Number(bill.total_amount))
    await admin.from("split_bills").update({ status: "finalized" }).eq("id", sessionId)
  }

  // Push a "KhunThong-style" update card back into the LINE group chat (if this
  // sport group was created from one) — fire-and-forget, never block the response.
  if (action === "pay" || action === "unpay" || action === "finalize") {
    notifySportGroup(sessionId, action, lineUserId)
  }

  const detail = await loadDetail(admin, sessionId, lineUserId)
  return NextResponse.json({ ok: true, group: detail })
}

// DELETE /api/liff/sport-groups/sessions/[sessionId]?lineUserId=Uxxx — delete a
// standalone session (e.g. duplicate created during testing). Only the creator
// may delete it. Cascades to split_participants/session_expenses.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")
  if (!lineUserId) return NextResponse.json({ error: "lineUserId required" }, { status: 400 })

  const admin = createAdminClient()
  const { data: bill } = await admin.from("split_bills")
    .select("id, creator_id")
    .eq("id", sessionId).eq("category", "sport").maybeSingle()
  if (!bill) return NextResponse.json({ error: "ไม่พบกลุ่ม" }, { status: 404 })

  const conn = await resolveConnection(admin, lineUserId)
  if (!conn || conn.user_id !== bill.creator_id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ลบกลุ่มนี้" }, { status: 403 })
  }

  await admin.from("split_bills").delete().eq("id", sessionId)

  return NextResponse.json({ ok: true })
}
