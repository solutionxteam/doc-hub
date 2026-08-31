/**
 * Mints a LiveKit join token for this trip's call room. LIVEKIT_API_SECRET
 * never leaves this route — see livekit-config.ts.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthedUser } from "@/lib/authed-user"
import { getTripAccess } from "@/lib/trips/trip-access"
import { mintCallToken } from "@/lib/trips/calls"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id: tripId } = await params
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const access = await getTripAccess(tripId, user.id)
  if (!access.allowed) return NextResponse.json({ error: "not found" }, { status: 404 })

  try {
    // conversationId reuses the trip's existing group conversation
    // (trip-conversation.ts) — not re-derived here to avoid a second
    // membership-sync path; pass tripId itself if no conversation lookup is
    // wired in yet, and revisit once trip-conversation.ts exposes a getter.
    const result = await mintCallToken(tripId, user.id, tripId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 })
  }
}
