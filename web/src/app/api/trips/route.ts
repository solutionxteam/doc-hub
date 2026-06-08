import { NextRequest, NextResponse } from "next/server"
import { createClient }       from "@/lib/supabase/server"
import { createAdminClient }  from "@/lib/supabase/admin"

function generateShareToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

// GET — list trips for an org
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = req.nextUrl.searchParams.get("orgId")
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  const { data: trips } = await supabase
    .from("life_journeys")
    .select(`
      id, title, trip_type, sport_type, destination, venue,
      event_date, started_at, ended_at, status, split_mode,
      share_token, base_fee, cover_emoji, notes, created_at,
      trip_participants(id, display_name, amount_owed, amount_paid, is_host, promptpay_type, qr_image_url)
    `)
    .eq("organization_id", orgId)
    .not("trip_type", "is", null)
    .order("created_at", { ascending: false })

  const enriched = (trips ?? []).map(t => ({
    ...t,
    participant_count: (t.trip_participants as any[]).length,
    total_owed: (t.trip_participants as any[]).reduce((s, p) => s + Number(p.amount_owed), 0),
    total_paid: (t.trip_participants as any[]).reduce((s, p) => s + Number(p.amount_paid), 0),
  }))

  return NextResponse.json({ trips: enriched })
}

// POST — create a new trip/activity/food order
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    orgId:        string
    title:        string
    trip_type:    "travel" | "food_order" | "sport" | "general"
    sport_type?:  string
    destination?: string
    venue?:       string
    event_date?:  string
    started_at?:  string
    ended_at?:    string
    split_mode:   "equal" | "individual" | "custom"
    base_fee?:    number
    cover_emoji?: string
    notes?:       string
    participants: Array<{
      display_name:    string
      line_user_id?:   string
      is_host?:        boolean
      promptpay_type?: string
      promptpay_value?: string
    }>
  }

  const { orgId, title, trip_type, participants, ...rest } = body
  if (!orgId || !title || !trip_type) {
    return NextResponse.json({ error: "orgId, title, trip_type required" }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create journey
  const { data: journey, error: jErr } = await admin.from("life_journeys").insert({
    organization_id: orgId,
    user_id:         user.id,
    title,
    trip_type,
    sport_type:      rest.sport_type ?? null,
    destination:     rest.destination ?? null,
    venue:           rest.venue ?? null,
    event_date:      rest.event_date ?? null,
    started_at:      rest.started_at ?? null,
    ended_at:        rest.ended_at ?? null,
    split_mode:      rest.split_mode ?? "equal",
    base_fee:        rest.base_fee ?? 0,
    cover_emoji:     rest.cover_emoji ?? (trip_type === "travel" ? "✈️" : trip_type === "sport" ? "🏸" : trip_type === "food_order" ? "🍽️" : "💰"),
    notes:           rest.notes ?? null,
    journey_type:    trip_type === "travel" ? "trip" : "event",
    share_token:     generateShareToken(),
    status:          "active",
  }).select("id, share_token").single()

  if (jErr || !journey) return NextResponse.json({ error: jErr?.message }, { status: 500 })

  // Create participants
  if (participants?.length) {
    await admin.from("trip_participants").insert(
      participants.map(p => ({
        journey_id:      journey.id,
        display_name:    p.display_name,
        line_user_id:    p.line_user_id ?? null,
        is_host:         p.is_host ?? false,
        is_non_line:     !p.line_user_id,
        promptpay_type:  p.promptpay_type ?? null,
        promptpay_value: p.promptpay_value ?? null,
        amount_owed:     0,
        amount_paid:     0,
      }))
    )
  }

  return NextResponse.json({ tripId: journey.id, shareToken: journey.share_token })
}
