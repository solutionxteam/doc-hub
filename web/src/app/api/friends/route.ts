import { NextRequest, NextResponse } from "next/server"
import { createClient }      from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/friends — list accepted friends + pending requests
export async function GET() {
  const sb   = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const uid   = user.id

  const [{ data: accepted }, { data: pending }, { data: sent }] = await Promise.all([
    admin.from("friendships")
      .select("id, source, created_at, requester_id, addressee_id, requester:requester_id(id,full_name,avatar_url), addressee:addressee_id(id,full_name,avatar_url)")
      .eq("status", "accepted")
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
    admin.from("friendships")
      .select("id, source, created_at, requester:requester_id(id,full_name,avatar_url)")
      .eq("status", "pending")
      .eq("addressee_id", uid),
    admin.from("friendships")
      .select("id, status, created_at, addressee:addressee_id(id,full_name,avatar_url)")
      .eq("requester_id", uid)
      .eq("status", "pending"),
  ])

  const friends = (accepted ?? []).map((f: any) => ({
    friendshipId: f.id,
    source: f.source,
    friend: f.requester_id === uid ? f.addressee : f.requester,
  }))

  return NextResponse.json({ friends, pendingReceived: pending ?? [], pendingSent: sent ?? [] })
}

// POST /api/friends — send friend request { addresseeId }
export async function POST(req: NextRequest) {
  const sb   = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { addresseeId, source = "search" } = await req.json()
  if (!addresseeId) return NextResponse.json({ error: "addresseeId required" }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from("friendships").insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    source,
  }).select("id").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, id: data.id })
}
