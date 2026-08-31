/**
 * Minting a LiveKit room-join token for a trip's voice call. See
 * docs/superpowers/specs/2026-08-31-trip-location-and-calling-design.md §7.
 *
 * One room per trip at a time — joining an already-ringing/active call
 * reuses its room rather than starting a second, disconnected one.
 */
import { AccessToken } from "livekit-server-sdk"
import { getLiveKitServerConfig } from "./livekit-config.ts"

export interface CallsDb {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        eq(col: string, val: string): { maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }> }
      }
    }
    insert(row: Record<string, unknown>): { select(cols: string): { single(): PromiseLike<{ data: Record<string, unknown>; error: { message: string } | null }> } }
    update(patch: Record<string, unknown>): { eq(col: string, val: string): PromiseLike<{ error: { message: string } | null }> }
  }
}

async function defaultDb(): Promise<CallsDb> {
  const { createAdminClient } = await import("@/lib/supabase/admin")
  return createAdminClient() as unknown as CallsDb
}

export interface CallToken { token: string; url: string; roomName: string; callSessionId: string }

export async function mintCallToken(
  journeyId: string, userId: string, conversationId: string, db?: CallsDb,
): Promise<CallToken> {
  const admin = db ?? await defaultDb()
  const { url, apiKey, apiSecret } = getLiveKitServerConfig()

  const { data: existing, error: findErr } = await admin.from("trip_call_sessions")
    .select("id, room_name, status")
    .eq("journey_id", journeyId)
    .eq("status", "ringing")
    .maybeSingle()
  if (findErr) throw new Error(findErr.message)

  let callSessionId: string
  let roomName: string
  if (existing) {
    callSessionId = existing.id as string
    roomName = existing.room_name as string
  } else {
    roomName = `trip-${journeyId}`
    const { data: created, error: insErr } = await admin.from("trip_call_sessions")
      .insert({ journey_id: journeyId, conversation_id: conversationId, room_name: roomName, initiator_id: userId, status: "ringing" })
      .select("id")
      .single()
    if (insErr) throw new Error(insErr.message)
    callSessionId = created.id as string
  }

  const at = new AccessToken(apiKey, apiSecret, { identity: userId })
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true })
  const token = await at.toJwt()

  return { token, url, roomName, callSessionId }
}

export async function endCallSession(callSessionId: string, db?: CallsDb): Promise<void> {
  const admin = db ?? await defaultDb()
  const { error } = await admin.from("trip_call_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", callSessionId)
  if (error) throw new Error(error.message)
}
