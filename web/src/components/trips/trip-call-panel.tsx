"use client"

import { useRef, useState } from "react"
import { Room } from "livekit-client"
import { Phone, PhoneOff } from "lucide-react"

/** Voice-only for this plan — no camera track is ever requested or
 * published, per the locked-in decision in the design spec. */
export function CallButton({ tripId }: { tripId: string }) {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const roomRef = useRef<Room | null>(null)
  const callSessionIdRef = useRef<string | null>(null)

  async function join() {
    setConnecting(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/calls/token`, { method: "POST" })
      if (!res.ok) throw new Error((await res.json()).error ?? "เข้าร่วมสายไม่สำเร็จ")
      const { token, url, callSessionId } = await res.json() as { token: string; url: string; callSessionId: string }

      const room = new Room()
      await room.connect(url, token)
      await room.localParticipant.setMicrophoneEnabled(true)
      roomRef.current = room
      callSessionIdRef.current = callSessionId
      setConnected(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : "เข้าร่วมสายไม่สำเร็จ")
    } finally {
      setConnecting(false)
    }
  }

  async function leave() {
    roomRef.current?.disconnect()
    roomRef.current = null
    setConnected(false)
    // Ending the last participant's call session is a server decision
    // (does someone else remain in the room?) — left for a later pass once
    // there's a way to check room occupancy; not blocking for this plan,
    // since the room simply sits idle with no participants otherwise.
  }

  if (connected) {
    return (
      <button onClick={leave} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700">
        <PhoneOff className="h-3.5 w-3.5" />วางสาย
      </button>
    )
  }
  return (
    <button onClick={join} disabled={connecting} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50">
      <Phone className="h-3.5 w-3.5" />{connecting ? "กำลังเชื่อมต่อ…" : "โทร"}
    </button>
  )
}
