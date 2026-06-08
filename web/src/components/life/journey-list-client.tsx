"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Plus, MapPin, Calendar, Trash2, Edit3, X, Loader2, ChevronRight } from "lucide-react"

type Journey = {
  id: string; title: string; description: string | null
  journey_type: string; cover_emoji: string
  started_at: string | null; ended_at: string | null
  destination: string | null; count?: number; total?: number
}

const fmtTHB  = (n: number) => "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })

const JOURNEY_TYPES = [
  { id: "trip",       emoji: "✈️", label: "ทริปท่องเที่ยว" },
  { id: "event",      emoji: "🎉", label: "งาน/อีเวนต์"    },
  { id: "experience", emoji: "⭐", label: "ประสบการณ์"      },
  { id: "milestone",  emoji: "🏆", label: "เหตุการณ์สำคัญ" },
  { id: "business",   emoji: "💼", label: "เดินทางธุรกิจ"  },
]

/* ─── Create Modal ─────────────────────────────────────────────────────────── */
function CreateJourneyModal({ orgId, onClose, onCreate }: {
  orgId:    string
  onClose:  () => void
  onCreate: (j: Journey) => void
}) {
  const [title,       setTitle]       = useState("")
  const [desc,        setDesc]        = useState("")
  const [type,        setType]        = useState("trip")
  const [emoji,       setEmoji]       = useState("✈️")
  const [destination, setDestination] = useState("")
  const [startedAt,   setStartedAt]   = useState("")
  const [endedAt,     setEndedAt]     = useState("")
  const [saving,      setSaving]      = useState(false)

  const handleTypeSelect = (t: typeof JOURNEY_TYPES[0]) => { setType(t.id); setEmoji(t.emoji) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/life/journeys", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orgId, title: title.trim(), description: desc.trim() || null,
          journey_type: type, cover_emoji: emoji,
          destination: destination.trim() || null,
          started_at: startedAt || null, ended_at: endedAt || null,
        }),
      })
      const { journeyId } = await res.json()
      const newJourney: Journey = {
        id: journeyId, title: title.trim(), description: desc || null,
        journey_type: type, cover_emoji: emoji,
        started_at: startedAt || null, ended_at: endedAt || null,
        destination: destination || null,
      }
      onCreate(newJourney)
      toast.success("บันทึกการเดินทางแล้ว 🗺️")
      onClose()
    } catch { toast.error("เกิดข้อผิดพลาด") }
    finally  { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-semibold">บันทึกการเดินทาง</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>

          {/* Journey type */}
          <div>
            <label className="block text-[11.5px] font-medium text-muted-foreground mb-2">ประเภท</label>
            <div className="grid grid-cols-5 gap-2">
              {JOURNEY_TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => handleTypeSelect(t)}
                  className={cn("flex flex-col items-center gap-1 p-2 rounded-[10px] border transition-colors text-xs",
                    type === t.id ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-border hover:bg-muted/50")}>
                  <span className="text-xl">{t.emoji}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight text-center">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">ชื่อ *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น ทริปเชียงใหม่, งาน Tech Conference"
                className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">สถานที่ปลายทาง</label>
              <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="เช่น เชียงใหม่, Tokyo, Singapore"
                className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">วันที่เริ่ม</label>
                <input type="date" value={startedAt} onChange={e => setStartedAt(e.target.value)}
                  className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">วันที่สิ้นสุด</label>
                <input type="date" value={endedAt} onChange={e => setEndedAt(e.target.value)}
                  className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">บันทึก</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="รายละเอียดเพิ่มเติม..."
                className="w-full rounded-[10px] border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 h-10 rounded-[10px] border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
              <button type="submit" disabled={saving}
                className="flex-1 h-10 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} บันทึก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export function JourneyListClient({ orgId, journeys: initial }: { orgId: string; journeys: Journey[] }) {
  const [journeys,  setJourneys]  = useState(initial)
  const [showModal, setShowModal] = useState(false)

  const totalSpent = journeys.reduce((s, j) => s + (j.total ?? 0), 0)

  const handleDelete = async (id: string) => {
    if (!confirm("ลบการเดินทางนี้?")) return
    setJourneys(p => p.filter(j => j.id !== id))
    await fetch("/api/life/journeys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ journeyId: id }) })
    toast.success("ลบแล้ว")
  }

  return (
    <div className="p-6 lg:p-7 max-w-[800px] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-2xl">🗺️</div>
          <div>
            <h2 className="text-xl font-bold">การเดินทาง</h2>
            <p className="text-sm text-muted-foreground">บันทึกทริปและเชื่อมค่าใช้จ่ายกับประสบการณ์</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> บันทึกทริปใหม่
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "ทริปทั้งหมด",    value: journeys.length.toString(),    emoji: "🗺️" },
          { label: "ค่าใช้จ่ายรวม", value: fmtTHB(totalSpent),            emoji: "💰" },
          { label: "เฉลี่ยต่อทริป",  value: journeys.length ? fmtTHB(totalSpent / journeys.length) : "—", emoji: "📊" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-2xl mb-1">{s.emoji}</p>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Journey list */}
      {journeys.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center py-16 text-center">
          <div className="text-5xl mb-4">🧳</div>
          <p className="font-medium text-lg">ยังไม่มีการเดินทาง</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">บันทึกทริปของคุณเพื่อเชื่อมค่าใช้จ่ายกับประสบการณ์</p>
          <button onClick={() => setShowModal(true)}
            className="h-9 px-5 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
            บันทึกทริปแรก
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {journeys.map(j => {
            const dur = j.started_at && j.ended_at
              ? Math.max(1, Math.ceil((new Date(j.ended_at).getTime() - new Date(j.started_at).getTime()) / 86400000))
              : null
            return (
              <div key={j.id} className="rounded-xl border bg-card overflow-hidden hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">{j.cover_emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{j.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {j.destination && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.destination}</span>}
                      {j.started_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(j.started_at)}{dur ? ` · ${dur} วัน` : ""}</span>}
                      {(j.count ?? 0) > 0 && <span>{j.count} รายการค่าใช้จ่าย</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {(j.total ?? 0) > 0 && <p className="font-semibold">{fmtTHB(j.total ?? 0)}</p>}
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <button onClick={() => handleDelete(j.id)}
                        className="h-7 w-7 rounded-[6px] hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center text-muted-foreground hover:text-rose-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                {j.description && (
                  <div className="px-5 pb-3 text-xs text-muted-foreground border-t pt-2.5">{j.description}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <CreateJourneyModal orgId={orgId} onClose={() => setShowModal(false)}
          onCreate={j => setJourneys(p => [j, ...p])} />
      )}
    </div>
  )
}
