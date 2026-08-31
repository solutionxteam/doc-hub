"use client"

import { useState } from "react"
import { Locate, LocateOff, X } from "lucide-react"
import { useLocationShares, type ShareDuration } from "@/lib/trips/use-location-shares"
import { cn } from "@/lib/utils"

const OPTIONS: { value: ShareDuration; label: string }[] = [
  { value: "15m", label: "15 นาที" },
  { value: "1h",  label: "1 ชั่วโมง" },
  { value: "4h",  label: "4 ชั่วโมง" },
  { value: "eod", label: "จนถึงสิ้นวัน" },
]

/** Button + duration sheet + persistent banner while active. Exported hook
 * state (`others`) is meant to be read separately by trip-map.tsx via its
 * own useLocationShares(tripId) call — React Query-less duplication is
 * intentional here: the alternative (lifting state up) would mean every
 * consumer of the map also has to know about location sharing, and this
 * hook's own 10s poll is cheap enough that two independent instances per
 * page cost nothing a user would notice. */
export function LocationShareControl({ tripId }: { tripId: string }) {
  const { mySession, start, stop } = useLocationShares(tripId)
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <>
      <button
        onClick={() => (mySession ? stop() : setShowPicker(true))}
        className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold",
          mySession ? "border-brand-500 bg-brand-50 text-brand-700" : "bg-card hover:bg-muted/50")}>
        {mySession ? <LocateOff className="h-3.5 w-3.5" /> : <Locate className="h-3.5 w-3.5" />}
        {mySession ? "หยุดแชร์ตำแหน่ง" : "แชร์ตำแหน่ง"}
      </button>

      {mySession && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          กำลังแชร์ตำแหน่ง
        </div>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowPicker(false)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-card p-4 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">แชร์ตำแหน่งนานแค่ไหน</p>
              <button onClick={() => setShowPicker(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">เพื่อนร่วมทริปจะเห็นตำแหน่งของคุณแบบสด ๆ จนกว่าจะหมดเวลาหรือคุณกดหยุด</p>
            {OPTIONS.map(o => (
              <button key={o.value} disabled={busy}
                onClick={async () => { setBusy(true); await start(o.value); setBusy(false); setShowPicker(false) }}
                className="block w-full rounded-xl p-3 text-left text-sm hover:bg-muted/50 disabled:opacity-50">
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
