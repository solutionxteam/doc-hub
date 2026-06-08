"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Plus, Plane, Utensils, Trophy, DollarSign,
  Users, ChevronRight, X, Loader2, QrCode,
  CheckCircle2, Clock, MapPin, Calendar,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────
type Participant = {
  id: string; display_name: string; amount_owed: number
  amount_paid: number; is_host: boolean; qr_image_url: string | null
}
type Trip = {
  id: string; title: string; trip_type: string; sport_type: string | null
  destination: string | null; venue: string | null; event_date: string | null
  started_at: string | null; ended_at: string | null; status: string
  split_mode: string; share_token: string | null; base_fee: number
  cover_emoji: string; notes: string | null; created_at: string
  trip_participants: Participant[]
}

const fmtTHB  = (n: number) => "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" })

const TRIP_TYPES = [
  { id: "travel",     emoji: "✈️", label: "ทริปท่องเที่ยว",   icon: Plane },
  { id: "food_order", emoji: "🍽️", label: "บิลอาหาร",        icon: Utensils },
  { id: "sport",      emoji: "🏸", label: "กิจกรรมกีฬา",      icon: Trophy },
  { id: "general",    emoji: "💰", label: "หารบิลทั่วไป",     icon: DollarSign },
]

const SPORTS = ["แบดมินตัน","บาสเกตบอล","ฟุตบอล","เทนนิส","ว่ายน้ำ","กอล์ฟ","วอลเลย์บอล","ปิงปอง"]

/* ─── Create Trip Modal ─────────────────────────────────────────────────────── */
function CreateTripModal({ orgId, onClose, onCreate }: {
  orgId: string; onClose: () => void; onCreate: (t: Trip) => void
}) {
  const [step,       setStep]       = useState<1|2>(1)
  const [tripType,   setTripType]   = useState<string>("")
  const [title,      setTitle]      = useState("")
  const [destination,setDestination]= useState("")
  const [venue,      setVenue]      = useState("")
  const [sportType,  setSportType]  = useState("")
  const [baseFee,    setBaseFee]    = useState("")
  const [eventDate,  setEventDate]  = useState("")
  const [splitMode,  setSplitMode]  = useState<"equal"|"individual">("equal")
  const [participants, setParticipants] = useState([{ name: "", promptpay: "", is_host: true }])
  const [saving,     setSaving]     = useState(false)

  const addParticipant = () => setParticipants(p => [...p, { name: "", promptpay: "", is_host: false }])
  const removeParticipant = (i: number) => setParticipants(p => p.filter((_, j) => j !== i))

  const handleCreate = async () => {
    if (!tripType || !title.trim()) { toast.error("กรอกประเภทและชื่อกิจกรรม"); return }
    const validParts = participants.filter(p => p.name.trim())
    if (!validParts.length) { toast.error("เพิ่มสมาชิกอย่างน้อย 1 คน"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/trips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId, title: title.trim(), trip_type: tripType,
          sport_type: sportType || null, destination: destination || null,
          venue: venue || null, event_date: eventDate || null,
          split_mode: splitMode, base_fee: Number(baseFee) || 0,
          participants: validParts.map(p => ({
            display_name: p.name.trim(), is_host: p.is_host,
            promptpay_type: p.promptpay ? "phone" : undefined,
            promptpay_value: p.promptpay || undefined,
          })),
        }),
      })
      const { tripId } = await res.json()
      toast.success("สร้างกิจกรรมแล้ว 🎉")
      // Redirect to trip detail
      window.location.href = `/trips/${tripId}`
    } catch { toast.error("เกิดข้อผิดพลาด") } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[17px] font-semibold">สร้างกิจกรรมใหม่</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>

          {/* Step 1: Type + Basic info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-2">ประเภทกิจกรรม *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRIP_TYPES.map(t => (
                    <button key={t.id} type="button" onClick={() => setTripType(t.id)}
                      className={cn("flex items-center gap-2.5 p-3 rounded-[10px] border text-left transition-colors",
                        tripType === t.id ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-border hover:bg-muted/50")}>
                      <span className="text-xl">{t.emoji}</span>
                      <span className="text-sm font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {tripType === "sport" && (
                <div>
                  <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ประเภทกีฬา</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SPORTS.map(s => (
                      <button key={s} type="button" onClick={() => setSportType(s)}
                        className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                          sportType === s ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600" : "border-border hover:bg-muted/50")}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">
                  {tripType === "travel" ? "ชื่อทริป" : tripType === "food_order" ? "ชื่อร้านอาหาร / โอกาส" : "ชื่อกิจกรรม"} *
                </label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={tripType === "travel" ? "เที่ยวเชียงใหม่ ม.ค. 68" : tripType === "food_order" ? "ข้าวมันไก่ร้านป้าแดง" : "แบดฯ สุดสัปดาห์"}
                  className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
              </div>

              {tripType === "travel" && (
                <div>
                  <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ปลายทาง</label>
                  <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="เชียงใหม่, Tokyo, ..."
                    className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
                </div>
              )}

              {(tripType === "sport" || tripType === "food_order") && (
                <div>
                  <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">สถานที่ / สนาม</label>
                  <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="สนามแบดฯ อโศก"
                    className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">วันที่</label>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                    className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
                </div>
                {(tripType === "sport" || tripType === "general") && (
                  <div>
                    <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ค่าสนาม/ค่าใช้จ่ายเบื้องต้น</label>
                    <input type="number" value={baseFee} onChange={e => setBaseFee(e.target.value)} placeholder="฿"
                      className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-2">วิธีหาร</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: "equal", label: "หารเท่า", sub: "ทุกคนจ่ายเท่ากัน" }, { id: "individual", label: "รายบุคคล", sub: "ใครสั่งอะไรจ่ายของตัว" }].map(m => (
                    <button key={m.id} type="button" onClick={() => setSplitMode(m.id as any)}
                      className={cn("flex flex-col p-3 rounded-[10px] border text-left transition-colors",
                        splitMode === m.id ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-border hover:bg-muted/50")}>
                      <span className="text-sm font-semibold">{m.label}</span>
                      <span className="text-[11px] text-muted-foreground">{m.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setStep(2)} disabled={!tripType || !title.trim()}
                className="w-full h-10 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                ถัดไป — เพิ่มสมาชิก →
              </button>
            </div>
          )}

          {/* Step 2: Participants */}
          {step === 2 && (
            <div className="space-y-4">
              <button onClick={() => setStep(1)} className="text-sm text-brand-500">← กลับ</button>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11.5px] font-medium text-muted-foreground">สมาชิก</label>
                  <button type="button" onClick={addParticipant} className="text-[11px] text-brand-500 font-medium">+ เพิ่มสมาชิก</button>
                </div>
                <div className="space-y-2">
                  {participants.map((p, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex gap-2">
                        <input value={p.name} onChange={e => setParticipants(prev => prev.map((pp, j) => j===i ? {...pp, name: e.target.value} : pp))}
                          placeholder={i === 0 ? "ชื่อคุณ (เจ้าของบิล)" : `คนที่ ${i+1}`}
                          className="flex-1 h-9 rounded-[8px] border bg-background px-2.5 text-sm outline-none focus:border-brand-500" />
                        {participants.length > 1 && (
                          <button type="button" onClick={() => removeParticipant(i)}
                            className="h-9 w-9 rounded-[8px] hover:bg-rose-50 flex items-center justify-center text-muted-foreground hover:text-rose-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <input value={p.promptpay}
                        onChange={e => setParticipants(prev => prev.map((pp, j) => j===i ? {...pp, promptpay: e.target.value} : pp))}
                        placeholder="เบอร์ PromptPay (ไม่บังคับ — สำหรับรับเงิน)"
                        className="w-full h-8 rounded-[8px] border bg-background px-2.5 text-[12px] outline-none focus:border-brand-500 text-muted-foreground" />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  💡 ใส่เบอร์ PromptPay เพื่อให้สมาชิกอื่นโอนเงินผ่าน QR ได้
                </p>
              </div>

              <button onClick={handleCreate} disabled={saving}
                className="w-full h-10 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                สร้างกิจกรรม 🎉
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Trip Card ──────────────────────────────────────────────────────────────── */
function TripCard({ trip }: { trip: Trip }) {
  const router = useRouter()
  const totalOwed  = trip.trip_participants.reduce((s, p) => s + Number(p.amount_owed), 0)
  const totalPaid  = trip.trip_participants.reduce((s, p) => s + Number(p.amount_paid), 0)
  const settled    = totalOwed > 0 && totalPaid >= totalOwed
  const pct        = totalOwed > 0 ? Math.min((totalPaid / totalOwed) * 100, 100) : 0

  return (
    <button onClick={() => router.push(`/trips/${trip.id}`)}
      className="w-full text-left rounded-xl border bg-card hover:shadow-sm transition-all overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0",
          trip.status === "settled" ? "bg-emerald-500/10" : "bg-muted")}>
          {trip.cover_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{trip.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {(trip.destination || trip.venue) && (
              <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{trip.destination ?? trip.venue}</span>
            )}
            {trip.event_date && (
              <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{fmtDate(trip.event_date)}</span>
            )}
            <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{trip.trip_participants.length} คน</span>
          </div>
          {totalOwed > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1 max-w-[100px]">
                <div className={cn("h-full rounded-full transition-all", settled ? "bg-emerald-500" : "bg-brand-500")}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{fmtTHB(totalPaid)}/{fmtTHB(totalOwed)}</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          {totalOwed > 0 && <p className="font-bold">{fmtTHB(totalOwed)}</p>}
          {settled
            ? <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-medium">✓ เคลียร์แล้ว</span>
            : totalOwed - totalPaid > 0
            ? <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full font-medium">ค้าง {fmtTHB(totalOwed - totalPaid)}</span>
            : null}
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 ml-auto" />
        </div>
      </div>
    </button>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────────── */
export function TripsClient({ orgId, trips: initial }: { orgId: string; trips: Trip[] }) {
  const [trips,     setTrips]     = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const filtered = typeFilter === "all" ? trips : trips.filter(t => t.trip_type === typeFilter)
  const totalActive = trips.filter(t => t.status !== "settled").length
  const totalOwed   = trips.flatMap(t => t.trip_participants).reduce((s, p) => s + Number(p.amount_owed) - Number(p.amount_paid), 0)

  return (
    <div className="p-6 lg:p-7 max-w-[900px] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">ทริป & กิจกรรม</h2>
          <p className="text-sm text-muted-foreground">จัดการค่าใช้จ่ายและหารบิลกับเพื่อน</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> สร้างกิจกรรม
        </button>
      </div>

      {/* Stats */}
      {trips.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "กิจกรรมที่กำลังดำเนินการ", value: totalActive.toString(), emoji: "🗺️" },
            { label: "ยอดรอจ่าย", value: totalOwed > 0 ? fmtTHB(totalOwed) : "เคลียร์หมดแล้ว", emoji: totalOwed > 0 ? "💰" : "✅" },
            { label: "กิจกรรมทั้งหมด", value: trips.length.toString(), emoji: "📋" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border bg-card p-4">
              <p className="text-2xl mb-1">{s.emoji}</p>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[{ id: "all", label: "ทั้งหมด" }, ...TRIP_TYPES.map(t => ({ id: t.id, label: `${t.emoji} ${t.label}` }))].map(f => (
          <button key={f.id} onClick={() => setTypeFilter(f.id)}
            className={cn("px-3 h-8 rounded-full text-xs font-medium transition-colors",
              typeFilter === f.id ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Trip list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center py-16 text-center">
          <div className="text-5xl mb-3">🗺️</div>
          <p className="font-medium text-lg">ยังไม่มีกิจกรรม</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">สร้างทริป บิลอาหาร หรือบิลกีฬากับเพื่อน</p>
          <button onClick={() => setShowModal(true)}
            className="h-9 px-5 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
            สร้างกิจกรรมแรก
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => <TripCard key={t.id} trip={t} />)}
        </div>
      )}

      {showModal && <CreateTripModal orgId={orgId} onClose={() => setShowModal(false)} onCreate={t => setTrips(p => [t, ...p])} />}
    </div>
  )
}
