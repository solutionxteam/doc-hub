"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Plus, Pill, Clock, Check, X, AlertTriangle, ChevronDown, ChevronUp, Loader2, Bell, BellOff, Package } from "lucide-react"

type Schedule = { id: string; times: string[]; dose_qty: number; meal_relation: string; meal_note: string | null; reminder_enabled: boolean }
type Inventory = { qty_remaining: number; qty_unit: string; low_stock_alert: number; expiry_date: string | null }
type Medication = {
  id: string; name: string; brand_name: string | null; dosage_form: string; strength: string | null
  category: string; purpose: string | null; is_chronic: boolean; color: string | null
  medication_schedules: Schedule[]; medication_inventory: Inventory | null
}
type Log = { id: string; medication_id: string; scheduled_at: string; taken_at: string | null; status: string; dose_taken: number }
type Adherence = { medication_id: string; adherence_pct: number; taken: number; total_doses: number }

const MEAL_LABEL: Record<string, string> = { before: "ก่อนอาหาร", after: "หลังอาหาร", with: "พร้อมอาหาร", any: "" }
const CAT_EMOJI: Record<string, string> = { chronic: "💊", prescription: "💉", supplement: "🌿", vitamin: "🍊", otc: "💊", other: "💊", general: "💊" }

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
const isLowStock = (inv: Inventory | null) => inv && Number(inv.qty_remaining) <= Number(inv.low_stock_alert)
const isExpiringSoon = (inv: Inventory | null) => {
  if (!inv?.expiry_date) return false
  return (new Date(inv.expiry_date).getTime() - Date.now()) < 30 * 86400000
}

/* ─── Add Medication Modal ───────────────────────────────────────────────────── */
function AddMedicationModal({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const [name,        setName]        = useState("")
  const [brand,       setBrand]       = useState("")
  const [form,        setForm]        = useState("tablet")
  const [strength,    setStrength]    = useState("")
  const [purpose,     setPurpose]     = useState("")
  const [isChronic,   setIsChronic]   = useState(false)
  const [times,       setTimes]       = useState(["08:00"])
  const [doseQty,     setDoseQty]     = useState("1")
  const [mealRelation,setMealRelation]= useState("after")
  const [qty,         setQty]         = useState("")
  const [lowAlert,    setLowAlert]    = useState("7")
  const [expiry,      setExpiry]      = useState("")
  const [reminder,    setReminder]    = useState(true)
  const [saving,      setSaving]      = useState(false)

  const addTime = () => setTimes(t => [...t, "12:00"])
  const removeTime = (i: number) => setTimes(t => t.filter((_, j) => j !== i))

  const handleSave = async () => {
    if (!name.trim()) { toast.error("กรอกชื่อยา"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/medications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), brand_name: brand || null,
          dosage_form: form, strength: strength || null,
          purpose: purpose || null, is_chronic: isChronic,
          times, dose_qty: Number(doseQty) || 1,
          meal_relation: mealRelation, reminder_enabled: reminder,
          qty_total: Number(qty) || 0, low_stock_alert: Number(lowAlert) || 7,
          expiry_date: expiry || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("เพิ่มยาแล้ว 💊")
      onCreate()
      onClose()
    } catch { toast.error("เกิดข้อผิดพลาด") } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-semibold">เพิ่มยา</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>

          {/* Basic info */}
          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ชื่อยา *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ยาลดความดัน, วิตามินซี"
              className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ชื่อการค้า</label>
              <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Norvasc, ..."
                className="w-full h-9 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ความแรง</label>
              <input value={strength} onChange={e => setStrength(e.target.value)} placeholder="5mg, 500mg"
                className="w-full h-9 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ใช้สำหรับ</label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="ลดความดัน, วิตามิน, ..."
              className="w-full h-9 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isChronic} onChange={e => setIsChronic(e.target.checked)} className="rounded" />
            <span className="text-sm">ยาเรื้อรัง (กินต่อเนื่องระยะยาว)</span>
          </label>

          {/* Schedule */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">ตารางการทาน</p>
              <button onClick={addTime} className="text-xs text-brand-500 font-medium">+ เพิ่มเวลา</button>
            </div>
            {times.map((t, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="time" value={t} onChange={e => setTimes(times.map((tt, j) => j === i ? e.target.value : tt))}
                  className="flex-1 h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500" />
                {times.length > 1 && <button onClick={() => removeTime(i)} className="h-9 w-9 rounded-[8px] hover:bg-rose-50 flex items-center justify-center text-muted-foreground hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">กี่เม็ดต่อครั้ง</label>
                <input type="number" min="0.5" step="0.5" value={doseQty} onChange={e => setDoseQty(e.target.value)}
                  className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ช่วงเวลาอาหาร</label>
                <select value={mealRelation} onChange={e => setMealRelation(e.target.value)}
                  className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500">
                  <option value="before">ก่อนอาหาร</option>
                  <option value="after">หลังอาหาร</option>
                  <option value="with">พร้อมอาหาร</option>
                  <option value="any">ไม่ระบุ</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" checked={reminder} onChange={e => setReminder(e.target.checked)} className="rounded" />
              <span className="text-sm">แจ้งเตือนผ่าน LINE</span>
            </label>
          </div>

          {/* Inventory */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-2">ข้อมูลสต็อก</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">จำนวนที่มี (เม็ด)</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="30"
                  className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">แจ้งเตือนเมื่อเหลือ</label>
                <input type="number" value={lowAlert} onChange={e => setLowAlert(e.target.value)} placeholder="7"
                  className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <div className="col-span-2">
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">วันหมดอายุ</label>
                <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
                  className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 h-10 rounded-[10px] border text-sm font-medium hover:bg-muted">ยกเลิก</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 h-10 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} บันทึก
            </button>
          </div>

          <p className="text-[10.5px] text-muted-foreground text-center">
            ⚠️ Slippy ช่วยแจ้งเตือน ไม่ใช่คำแนะนำทางการแพทย์ ปรึกษาแพทย์/เภสัชกรเสมอ
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Today's Dose Card ──────────────────────────────────────────────────────── */
function TodayDoseCard({ log, medication, onUpdate }: {
  log: Log; medication: Medication; onUpdate: (logId: string, status: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const isPending = log.status === "pending"
  const isTaken   = log.status === "taken" || log.status === "late"
  const isSkipped = log.status === "skipped"

  const mark = async (status: "taken" | "skipped") => {
    setLoading(true)
    try {
      await fetch("/api/medications", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id, status }),
      })
      onUpdate(log.id, status)
      toast.success(status === "taken" ? "✅ บันทึกแล้ว!" : "⏭️ ข้ามแล้ว")
    } catch { toast.error("เกิดข้อผิดพลาด") } finally { setLoading(false) }
  }

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors",
      isTaken  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-500/5" :
      isSkipped ? "border-muted bg-muted/20 opacity-60" :
      "border-border bg-card")}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0",
        isTaken ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-muted")}>
        {CAT_EMOJI[medication.category] ?? "💊"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{medication.name}</p>
        <p className="text-xs text-muted-foreground">
          {log.dose_taken} เม็ด
          {medication.medication_schedules[0]?.meal_relation !== "any" && ` · ${MEAL_LABEL[medication.medication_schedules[0]?.meal_relation]}`}
          {" · "}⏰ {fmtTime(log.scheduled_at)}
        </p>
      </div>
      {isPending && !loading && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => mark("taken")}
            className="h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => mark("skipped")}
            className="h-8 w-8 rounded-lg border hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
      {isTaken  && <span className="text-xs text-emerald-600 font-medium shrink-0">✓ ทานแล้ว</span>}
      {isSkipped && <span className="text-xs text-muted-foreground shrink-0">ข้าม</span>}
    </div>
  )
}

/* ─── Medication Card ────────────────────────────────────────────────────────── */
function MedicationCard({ med, adherence }: { med: Medication; adherence: Adherence | undefined }) {
  const [expanded, setExpanded] = useState(false)
  const inv     = med.medication_inventory
  const sched   = med.medication_schedules[0]
  const lowStock = isLowStock(inv)
  const expiring = isExpiringSoon(inv)
  const adherePct = adherence?.adherence_pct ?? null

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors text-left">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
          {CAT_EMOJI[med.category]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{med.name}</p>
            {med.is_chronic && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium">เรื้อรัง</span>}
            {lowStock  && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 font-medium flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />ยาเหลือน้อย</span>}
            {expiring  && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 font-medium">ใกล้หมดอายุ</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {med.strength && `${med.strength} · `}
            {sched ? `${sched.times.join(", ")} · ${sched.dose_qty} เม็ด` : "ไม่มีตาราง"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {inv && <span className="text-xs text-muted-foreground">{inv.qty_remaining} {inv.qty_unit}</span>}
          {adherePct !== null && (
            <span className={cn("text-xs font-semibold", adherePct >= 80 ? "text-emerald-600" : adherePct >= 60 ? "text-amber-600" : "text-rose-600")}>
              {adherePct}%
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-2 text-sm">
          {med.purpose    && <p className="text-muted-foreground">🎯 {med.purpose}</p>}
          {med.brand_name && <p className="text-muted-foreground">🏷️ {med.brand_name}</p>}
          {sched?.meal_relation !== "any" && <p className="text-muted-foreground">🍽️ {MEAL_LABEL[sched?.meal_relation ?? "any"]}{sched?.meal_note ? ` — ${sched.meal_note}` : ""}</p>}
          {inv?.expiry_date && <p className="text-muted-foreground">📅 หมดอายุ: {new Date(inv.expiry_date).toLocaleDateString("th-TH")}</p>}
          {sched && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {sched.reminder_enabled ? <Bell className="w-3.5 h-3.5 text-brand-500" /> : <BellOff className="w-3.5 h-3.5" />}
              {sched.reminder_enabled ? "แจ้งเตือนผ่าน LINE" : "ปิดแจ้งเตือน"}
            </div>
          )}
          {adherence && (
            <p className="text-xs text-muted-foreground">
              📊 ทานสม่ำเสมอ {adherePct}% ({adherence.taken}/{adherence.total_doses} ครั้ง)
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────────── */
export function MedicationsClient({ medications: initial, todayLogs: initialLogs, adherenceStats, userId }: {
  medications:    Medication[]
  todayLogs:      Log[]
  adherenceStats: Adherence[]
  userId:         string
}) {
  const [medications, setMedications] = useState(initial)
  const [logs,        setLogs]        = useState(initialLogs)
  const [showAdd,     setShowAdd]     = useState(false)

  const takenToday  = logs.filter(l => l.status === "taken" || l.status === "late").length
  const pendingToday = logs.filter(l => l.status === "pending").length
  const totalToday  = logs.length

  const handleLogUpdate = (logId: string, status: string) => {
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, status, taken_at: status !== "skipped" ? new Date().toISOString() : null } : l))
  }

  const adherenceMap = Object.fromEntries(adherenceStats.map(a => [a.medication_id, a]))

  return (
    <div className="p-6 lg:p-7 max-w-[800px] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">💊 จัดการยา</h2>
          <p className="text-sm text-muted-foreground">ติดตามการทานยาและสต็อกยาของคุณ</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> เพิ่มยา
        </button>
      </div>

      {/* Today's summary */}
      {totalToday > 0 && (
        <div className="rounded-xl border bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/5 dark:to-indigo-500/5 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm">วันนี้</p>
            <span className={cn("text-sm font-bold", takenToday === totalToday ? "text-emerald-600" : "text-amber-600")}>
              {takenToday}/{totalToday} มื้อ
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
            <div className={cn("h-full rounded-full transition-all", takenToday === totalToday ? "bg-emerald-500" : "bg-brand-500")}
              style={{ width: `${totalToday ? (takenToday / totalToday * 100) : 0}%` }} />
          </div>
          <div className="space-y-2">
            {logs.map(log => {
              const med = medications.find(m => m.id === log.medication_id)
              if (!med) return null
              return <TodayDoseCard key={log.id} log={log} medication={med} onUpdate={handleLogUpdate} />
            })}
          </div>
        </div>
      )}

      {/* Medication list */}
      {medications.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center py-14 text-center">
          <div className="text-5xl mb-3">💊</div>
          <p className="font-medium text-lg">ยังไม่มีรายการยา</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">เพิ่มยาที่กินประจำเพื่อรับการแจ้งเตือน</p>
          <button onClick={() => setShowAdd(true)}
            className="h-9 px-5 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
            เพิ่มยาแรก
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">ยาทั้งหมด ({medications.length} รายการ)</p>
          {medications.map(m => <MedicationCard key={m.id} med={m} adherence={adherenceMap[m.id]} />)}
        </div>
      )}

      <p className="text-[10.5px] text-muted-foreground text-center mt-6">
        ⚠️ แอปนี้ช่วยแจ้งเตือนเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์<br />
        กรุณาปรึกษาแพทย์หรือเภสัชกรก่อนเปลี่ยนแปลงการใช้ยา
      </p>

      {showAdd && <AddMedicationModal onClose={() => setShowAdd(false)} onCreate={() => window.location.reload()} />}
    </div>
  )
}
