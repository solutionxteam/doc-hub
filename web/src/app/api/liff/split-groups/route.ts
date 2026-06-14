import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Resolve a LINE userId → { organization_id, user_id } via line_connections.
// "หารบิล" groups require a linked account (same as sport/trip groups) — keeps
// creator_id/org consistent and avoids partial/orphaned connections.
async function resolveConnection(admin: ReturnType<typeof createAdminClient>, lineUserId: string) {
  const { data } = await admin.from("line_connections")
    .select("user_id, organization_id, display_name")
    .eq("line_user_id", lineUserId)
    .maybeSingle()
  return data
}

// GET /api/liff/split-groups?lineUserId=Uxxx — list "หารบิล" groups the user is in
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
    .select("id, title, note, total_amount, status, share_token, created_at, split_participants(id, name, amount, paid_at)")
    .in("id", billIds)
    .eq("category", "general")
    .order("created_at", { ascending: false })

  const groups = (bills ?? []).map((b: any) => {
    const paid  = (b.split_participants as any[]).filter(p => p.paid_at).length
    const total = (b.split_participants as any[]).length
    return {
      id:         b.id,
      title:      b.title,
      note:       b.note,
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

// POST /api/liff/split-groups — create a new "หารบิล" group (creator auto-joins)
export async function POST(req: NextRequest) {
  const { lineUserId, displayName, title, fee, note } = await req.json() as {
    lineUserId:  string
    displayName: string
    title:       string
    fee:         number
    note?:       string
  }

  if (!lineUserId || !title?.trim() || !fee || fee <= 0) {
    return NextResponse.json({ error: "lineUserId, title, fee required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const conn  = await resolveConnection(admin, lineUserId)
  if (!conn) return NextResponse.json({ needsConnect: true, error: "กรุณาเชื่อมบัญชี LINE ก่อน — เข้าสู่ระบบด้วย LINE ที่หน้า Slippy login (เชื่อมอัตโนมัติ) หรือพิมพ์ /connect CODE ในแชท" }, { status: 403 })

  const { data: bill, error } = await admin.from("split_bills")
    .insert({
      organization_id: conn.organization_id,
      creator_id:      conn.user_id,
      document_id:     null,
      category:        "general",
      title:           title.trim(),
      note:            note?.trim() || null,
      total_amount:    fee,
      status:          "open",
    })
    .select("id, share_token")
    .single()

  if (error || !bill) return NextResponse.json({ error: error?.message ?? "สร้างบิลไม่สำเร็จ" }, { status: 500 })

  // Auto-add creator as the first participant (gets the full fee until others join)
  await admin.from("split_participants").insert({
    split_bill_id: bill.id,
    name:          displayName ?? conn.display_name ?? "ผู้สร้างบิล",
    line_user_id:  lineUserId,
    line_display:  displayName ?? conn.display_name,
    is_non_line:   false,
    amount:        fee,
  })

  return NextResponse.json({ ok: true, id: bill.id, shareToken: bill.share_token })
}
