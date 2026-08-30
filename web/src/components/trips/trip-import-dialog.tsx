"use client"

/**
 * Import a travel document — upload, review what was read, accept what is right.
 *
 * The review step is the point of this dialog, not a formality. Everything
 * imported here comes from a machine reading small print, and the one thing
 * this codebase has learned repeatedly is that a machine-read value nobody
 * compared to the paper stays wrong forever while reconciling perfectly against
 * itself. So: nothing is written until a person ticks it, every proposal shows
 * what it will do, and proposals that cannot be filed say why before you accept
 * rather than after.
 */

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  X, UploadCloud, Loader2, FileText, AlertTriangle, Check, CalendarX2,
} from "lucide-react"
import { itemSpec } from "@/lib/trips/journey"

interface Proposed {
  type: string
  title: string
  subtitle: string | null
  date: string | null
  time_from: string | null
  time_to: string | null
  location: string | null
  end_location: string | null
  provider: string | null
  confirmation_code: string | null
  amount: number | null
  currency: string | null
  details: Record<string, unknown>
  notes: string | null
  confidence: number
}

interface TripDay { day_number: number; date: string | null; city: string | null }

interface ReadResult {
  document_kind: string
  items: Proposed[]
  issues: string[]
  pages_read: number
  tripDays: TripDay[]
}

/**
 * Which shelf of the document library this file belongs on — read from the
 * FIRST item, since a document proposes one coherent booking (a return
 * flight's two legs are still one e-ticket), never a mix of kinds.
 */
function documentKindFor(result: ReadResult): "ticket" | "hotel" | "other" {
  const type = result.items[0]?.type
  if (type === "hotel") return "hotel"
  if (type && type !== "restaurant" && type !== "activity" && type !== "other") return "ticket"
  return "other"
}

export function TripImportDialog({ tripId, onClose, onImported }: {
  tripId: string
  onClose: () => void
  onImported: () => void
}) {
  const [reading, setReading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [result,  setResult]  = useState<ReadResult | null>(null)
  const [picked,  setPicked]  = useState<Set<number>>(new Set())
  const [fileName, setFileName] = useState("")
  // Kept so the accepted file can also land in the trip's document library —
  // import-document itself only ever reads bytes in memory and never writes
  // them anywhere, so without this the E-ticket/receipt itself is gone the
  // moment the tab closes, leaving only the extracted rows.
  const [file, setFile] = useState<File | null>(null)
  const [keepFile, setKeepFile] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    setReading(true); setResult(null); setFileName(file.name); setFile(file)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/trips/${tripId}/import-document`, { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "อ่านเอกสารไม่สำเร็จ")
      const r = json as ReadResult
      setResult(r)
      // Pre-tick everything with a date — the accept step now creates whatever
      // day a date needs, so "no day yet" is no longer a reason to leave a row
      // unticked. An item with no date at all still can't be filed anywhere
      // (there is no day to put it on), so that stays unticked.
      setPicked(new Set(r.items.map((it, i) => (it.date ? i : -1)).filter(i => i >= 0)))
      if (!r.items.length) toast("ไม่พบรายการเดินทางในเอกสารนี้")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อ่านเอกสารไม่สำเร็จ")
    } finally {
      setReading(false)
    }
  }, [tripId])

  const accept = useCallback(async () => {
    if (!result || !picked.size) return
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/import-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: [...picked].map(i => result.items[i]) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "เพิ่มรายการไม่สำเร็จ")
      toast.success(`เพิ่ม ${json.created} รายการเข้าทริปแล้ว`)
      if (json.skipped?.length) {
        toast.warning(`ข้าม ${json.skipped.length} รายการ: ${json.skipped[0]}`)
      }

      // Best-effort: the itinerary rows are the part that must not fail
      // silently (that already happened, above); the original file landing
      // in the document library is a bonus on top of that, not a second
      // thing this whole action can fail on. A type the reader accepts but
      // the library does not (webp, gif) just quietly skips this part.
      if (keepFile && file) {
        try {
          const fd = new FormData()
          fd.append("file", file)
          fd.append("kind", documentKindFor(result))
          fd.append("title", result.document_kind || file.name)
          const docRes = await fetch(`/api/trips/${tripId}/documents`, { method: "POST", body: fd })
          if (!docRes.ok) throw new Error()
          toast.success("เก็บไฟล์เอกสารไว้ในคลังเอกสารของทริปแล้ว")
        } catch {
          toast.warning("เพิ่มรายการสำเร็จ แต่เก็บไฟล์ต้นฉบับไม่สำเร็จ — อัปโหลดเองได้ที่แท็บเอกสาร")
        }
      }

      onImported()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เพิ่มรายการไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }, [tripId, result, picked, file, keepFile, onImported, onClose])

  const tripDates = new Set(result?.tripDays.map(d => d.date) ?? [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
         role="dialog" aria-modal="true" aria-label="นำเข้าเอกสารการเดินทาง">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-3xl border bg-card shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/95 p-5 backdrop-blur">
          <div>
            <h2 className="text-lg font-bold">นำเข้าเอกสารการเดินทาง</h2>
            <p className="text-xs text-muted-foreground">
              ตั๋วเครื่องบิน ใบยืนยันโรงแรม ตั๋วรถไฟ เรือ หรือใบเช่ารถ — ระบบอ่านให้ ไม่ต้องพิมพ์เอง
            </p>
          </div>
          <button onClick={onClose} aria-label="ปิด"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* ── Upload ── */}
          {!result && (
            <>
              <button onClick={() => inputRef.current?.click()} disabled={reading}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer.files?.[0]
                  if (f) upload(f)
                }}
                className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 transition hover:bg-muted/40 disabled:opacity-60">
                {reading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                    <span className="text-sm font-medium">กำลังอ่าน {fileName}…</span>
                    <span className="text-xs text-muted-foreground">เอกสารหลายหน้าอาจใช้เวลาสักครู่</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium">ลากไฟล์มาวาง หรือกดเพื่อเลือก</span>
                    <span className="text-xs text-muted-foreground">JPEG · PNG · WebP · PDF · ไม่เกิน 12 MB</span>
                  </>
                )}
              </button>
              <input ref={inputRef} type="file" className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
            </>
          )}

          {/* ── Review ── */}
          {result && (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs">
                <FileText className="h-4 w-4 shrink-0 text-brand-500" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{result.document_kind}</span>
                  <span className="text-muted-foreground"> · {fileName} · {result.pages_read} หน้า</span>
                </span>
                <button onClick={() => { setResult(null); setPicked(new Set()) }}
                  className="shrink-0 font-semibold text-brand-600">เปลี่ยนไฟล์</button>
              </div>

              {result.issues.length > 0 && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />สิ่งที่ควรตรวจ
                  </p>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                    {result.issues.map((s, i) => <li key={i}>· {s}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                {result.items.map((it, i) => {
                  const spec = itemSpec(it.type)
                  const Icon = spec.icon
                  const hasDate = !!it.date
                  const isNewDay = hasDate && !tripDates.has(it.date!)
                  const on = picked.has(i)
                  return (
                    <button key={i} disabled={!hasDate}
                      onClick={() => setPicked(p => {
                        const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n
                      })}
                      className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                        !hasDate && "cursor-not-allowed opacity-60",
                        on ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "hover:bg-muted/40")}>
                      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border",
                        on ? "border-brand-500 bg-brand-500 text-white" : "border-muted-foreground/40")}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", spec.tile)}>
                        <Icon className={cn("h-4 w-4", spec.fg)} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{it.title}</span>
                        {it.subtitle && (
                          <span className="block truncate text-[11px] text-muted-foreground">{it.subtitle}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {it.date ?? "ไม่มีวันที่"}
                          {it.time_from && ` · ${it.time_from}`}
                          {it.time_to && `–${it.time_to}`}
                          {it.confirmation_code && ` · ${it.confirmation_code}`}
                          {it.amount != null && it.amount > 0 && ` · ${it.amount.toLocaleString()} ${it.currency ?? ""}`}
                        </span>
                        {!hasDate && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            <CalendarX2 className="h-3 w-3" />
                            เอกสารไม่ได้ระบุวันที่ — เพิ่มเองภายหลัง
                          </span>
                        )}
                        {isNewDay && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400">
                            <CalendarX2 className="h-3 w-3" />
                            จะสร้างวันที่ {it.date} ให้ใหม่
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={keepFile} onChange={e => setKeepFile(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-muted-foreground/40" />
                เก็บไฟล์ต้นฉบับนี้ไว้ในคลังเอกสารของทริปด้วย
              </label>

              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  เลือกแล้ว {picked.size} จาก {result.items.length} รายการ
                </p>
                <button onClick={accept} disabled={!picked.size || saving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  เพิ่มเข้าทริป
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
