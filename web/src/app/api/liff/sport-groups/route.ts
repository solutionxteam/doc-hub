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

// Resolve a LINE userId → { organization_id, user_id } via line_connections.
// Sport groups require a linked account (same as the chat /sportgroup flow) —
// this keeps creator_id/org consistent and avoids partial/orphaned connections.
async function resolveConnection(admin: ReturnType<typeof createAdminClient>, lineUserId: string) {
  const { data } = await admin.from("line_connections")
    .select("user_id, organization_id, display_name")
    .eq("line_user_id", lineUserId)
    .maybeSingle()
  return data
}

// GET /api/liff/sport-groups?lineUserId=Uxxx — list sport groups the user is in
export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")
  if (!lineUserId) return NextResponse.json({ error: "lineUserId required" }, { status: 400 })

  const admin = createAdminClient()
  const conn  = await resolveConnection(admin, lineUserId)
  if (!conn) return NextResponse.json({ needsConnect: true, groups: [] })

  // Groups where this LINE user is a participant (creator auto-joins on create)
  const { data: parts } = await admin.from("split_participants")
    .select("split_bill_id, amount, paid_at, name")
    .eq("line_user_id", lineUserId)

  const billIds = [...new Set((parts ?? []).map(p => p.split_bill_id))]
  if (billIds.length === 0) return NextResponse.json({ groups: [] })

  const { data: bills } = await admin.from("split_bills")
    .select("id, title, sport_type, venue, total_amount, status, share_token, created_at, split_participants(id, name, amount, paid_at)")
    .in("id", billIds)
    .eq("category", "sport")
    .order("created_at", { ascending: false })

  const groups = (bills ?? []).map((b: any) => {
    const myRow   = (b.split_participants as any[]).find(p => p.name) // best-effort; refined client-side via /sport-groups/[id]
    const paid    = (b.split_participants as any[]).filter(p => p.paid_at).length
    const total   = (b.split_participants as any[]).length
    return {
      id:         b.id,
      title:      b.title,
      emoji:      sportEmoji(b.sport_type ?? ""),
      sportType:  b.sport_type,
      venue:      b.venue,
      fee:        Number(b.total_amount),
      status:     b.status,
      shareToken: b.share_token,
      createdAt:  b.created_at,
      paidCount:  paid,
      headCount:  total,
    }
  })

  return NextResponse.json({ groups })
}

// POST /api/liff/sport-groups — create a new sport group (creator auto-joins)
export async function POST(req: NextRequest) {
  const { lineUserId, displayName, sportType, fee, venue } = await req.json() as {
    lineUserId:  string
    displayName: string
    sportType:   string
    fee:         number
    venue?:      string
  }

  if (!lineUserId || !sportType || !fee || fee <= 0) {
    return NextResponse.json({ error: "lineUserId, sportType, fee required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const conn  = await resolveConnection(admin, lineUserId)
  if (!conn) return NextResponse.json({ needsConnect: true, error: "กรุณาเชื่อมบัญชี LINE ก่อน (พิมพ์ /connect ในแชท)" }, { status: 403 })

  const title = venue ? `${sportType} @ ${venue}` : sportType

  const { data: bill, error } = await admin.from("split_bills")
    .insert({
      organization_id: conn.organization_id,
      creator_id:      conn.user_id,
      document_id:     null,
      category:        "sport",
      sport_type:      sportType,
      venue:           venue || null,
      title,
      total_amount:    fee,
      status:          "open",
    })
    .select("id, share_token")
    .single()

  if (error || !bill) return NextResponse.json({ error: error?.message ?? "สร้างกลุ่มไม่สำเร็จ" }, { status: 500 })

  // Auto-add creator as the first participant (gets the full fee until others join)
  await admin.from("split_participants").insert({
    split_bill_id: bill.id,
    name:          displayName ?? conn.display_name ?? "ผู้สร้างกลุ่ม",
    line_user_id:  lineUserId,
    line_display:  displayName ?? conn.display_name,
    is_non_line:   false,
    amount:        fee,
  })

  return NextResponse.json({ ok: true, id: bill.id, shareToken: bill.share_token })
}
