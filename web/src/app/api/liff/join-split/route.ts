import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST — Join a split bill via LIFF
export async function POST(req: NextRequest) {
  const { token, lineUserId, displayName, pictureUrl } = await req.json() as {
    token:        string
    lineUserId:   string
    displayName:  string
    pictureUrl?:  string
  }

  if (!token || !displayName) return NextResponse.json({ error: "token and displayName required" }, { status: 400 })

  const admin = createAdminClient()

  const { data: bill } = await admin.from("split_bills")
    .select("id, status, organization_id, category, total_amount")
    .eq("share_token", token)
    .single()

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 })
  if (bill.status === "finalized") return NextResponse.json({ error: "Bill is finalized" }, { status: 400 })

  // Check if already joined
  const { data: existing } = await admin.from("split_participants")
    .select("id").eq("split_bill_id", bill.id).eq("line_user_id", lineUserId).maybeSingle()

  if (existing) return NextResponse.json({ ok: true, alreadyJoined: true })

  await admin.from("split_participants").insert({
    split_bill_id: bill.id,
    name:          displayName,
    line_user_id:  lineUserId,
    line_display:  displayName,
    is_non_line:   false,
    amount:        0,
  })

  // Sport/Trip groups (category='sport'|'trip') split a flat fee EVENLY across
  // whoever has joined so far — recompute everyone's share now that the
  // headcount changed. (Receipt-based /split bills keep their
  // item-claim-derived amounts as-is.)
  if (bill.category === "sport" || bill.category === "trip") {
    const { data: parts } = await admin.from("split_participants")
      .select("id").eq("split_bill_id", bill.id)
    const n = parts?.length ?? 0
    if (n > 0) {
      const share = Math.round((Number(bill.total_amount ?? 0) / n) * 100) / 100
      for (const p of parts!) {
        await admin.from("split_participants").update({ amount: share }).eq("id", p.id)
      }
    }
  }

  return NextResponse.json({ ok: true, joined: true })
}
