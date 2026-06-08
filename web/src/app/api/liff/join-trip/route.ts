import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST — Join a trip via LIFF (no /connect required)
export async function POST(req: NextRequest) {
  const { token, lineUserId, displayName, pictureUrl } = await req.json() as {
    token:        string
    lineUserId:   string
    displayName:  string
    pictureUrl?:  string
  }

  if (!token || !displayName) return NextResponse.json({ error: "token and displayName required" }, { status: 400 })

  const admin = createAdminClient()

  // Find trip by token
  const { data: journey } = await admin.from("life_journeys")
    .select("id, status, organization_id")
    .eq("share_token", token)
    .single()

  if (!journey) return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  if (journey.status === "settled") return NextResponse.json({ error: "Trip is already settled" }, { status: 400 })

  // Check if already joined
  const { data: existing } = await admin.from("trip_participants")
    .select("id")
    .eq("journey_id", journey.id)
    .eq("line_user_id", lineUserId)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, alreadyJoined: true })

  // Add participant
  await admin.from("trip_participants").insert({
    journey_id:   journey.id,
    line_user_id: lineUserId,
    display_name: displayName,
    is_non_line:  false,
    is_host:      false,
    amount_owed:  0,
    amount_paid:  0,
  })

  // Also auto-register line_connection if not exists (lightweight — no full org link)
  // This lets the bot push notifications to this user for this trip
  const { data: existing_conn } = await admin.from("line_connections")
    .select("id").eq("line_user_id", lineUserId).maybeSingle()

  if (!existing_conn) {
    // Create a minimal connection record so we can push messages
    // Non-critical: create minimal line_connection so we can push notifications
    try {
      await admin.from("line_connections").insert({
        line_user_id:    lineUserId,
        organization_id: journey.organization_id,
        display_name:    displayName,
      })
    } catch { /* already exists or constraint violation — ignore */ }
  }

  return NextResponse.json({ ok: true, joined: true })
}
