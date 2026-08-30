"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Plus, Pill, Clock, Check, X, AlertTriangle, ChevronDown, ChevronUp, Loader2,
  Bell, BellOff, Package, ScanLine, ShoppingCart, Send,
} from "lucide-react"

type Schedule = { id: string; times: string[]; dose_qty: number; meal_relation: string; meal_note: string | null; reminder_enabled: boolean }
type Inventory = { qty_remaining: number; qty_unit: string; low_stock_alert: number; expiry_date: string | null }
type Medication = {
  id: string; name: string; brand_name: string | null; dosage_form: string; strength: string | null
  category: string; purpose: string | null; is_chronic: boolean; color: string | null
  /** A storage PATH despite the name — see the medication_label_images migration. Resolved to a signed URL on demand, never rendered directly. */
  image_url: string | null
  // PostgREST returns this embed as an array even though the app models it as
  // 1:1 — medication_inventory.medication_id has no UNIQUE constraint for
  // PostgREST to infer a to-one relation from, so it always returns a list,
  // same as medication_schedules. Take [0], not the whole array, everywhere
  // this is read (a raw `inv.qty_remaining` on an array silently reads
  // `undefined` — no runtime error, just a NaN nobody notices until it's
  // rendered, which is exactly what happened here before this was typed
  // correctly).
  medication_schedules: Schedule[]; medication_inventory: Inventory[]
}
type Log = { id: string; medication_id: string; scheduled_at: string; taken_at: string | null; status: string; dose_taken: number }
type Adherence = { medication_id: string; adherence_pct: number; taken: number; total_doses: number }

/** What GET /api/medications/reorder computes — matches ReorderItem there. */
type ReorderItem = {
  medicationId: string; name: string; brandName: string | null; strength: string | null
  qtyRemaining: number; qtyUnit: string; daysRemaining: number | null
  suggestedQty: number; reason: "low_stock" | "running_out_soon"
}

/** What POST /api/medications/scan proposes — read from a label photo, never written until reviewed. */
type ScannedMedication = {
  name: string; brand_name: string | null; generic_name: string | null
  dosage_form: string; strength: string | null; purpose: string | null
  instructions_verbatim: string | null
  times: string[]; dose_qty: number
  meal_relation: "before" | "after" | "with" | "any"; meal_note: string | null
  qty_total: number | null; qty_unit: string; expiry_date: string | null
  prescribing_doctor: string | null; hospital_name: string | null; lot_no: string | null
  confidence: number
}

const MEAL_LABEL: Record<string, string> = { before: "ก่อนอาหาร", after: "หลังอาหาร", with: "พร้อมอาหาร", any: "" }
const CAT_EMOJI: Record<string, string> = { chronic: "💊", prescription: "💉", supplement: "🌿", vitamin: "🍊", otc: "💊", other: "💊", general: "💊" }

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
const isLowStock = (inv: Inventory | null) => inv && Number(inv.qty_remaining) <= Number(inv.low_stock_alert)
const isExpiringSoon = (inv: Inventory | null) => {
  if (!inv?.expiry_date) return false
  return (new Date(inv.expiry_date).getTime() - Date.now()) < 30 * 86400000
}

/**
 * Days of stock left, from what's on hand ÷ what's actually being taken per
 * day — the number "จัดเวลาเดือนยาหมด" (schedule for when it runs out) needs.
 * Not `low_stock_alert` (that's a fixed threshold someone set once); this
 * recomputes from the real daily consumption every time inventory or the
 * schedule changes, so it stays right after a dose is logged.
 */
function daysRemaining(inv: Inventory | null, sched: Schedule | undefined): number | null {
  if (!inv || !sched || !sched.times.length) return null
  const perDay = Number(sched.dose_qty) * sched.times.length
  if (!perDay || !Number.isFinite(perDay)) return null
  return Math.floor(Number(inv.qty_remaining) / perDay)
}

function runOutDate(days: number | null): string | null {
  if (days == null) return null
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" })
}

/* ─── Add Medication Modal ───────────────────────────────────────────────────── */
function AddMedicationModal({ onClose, onCreate, scanned, scanIssues }: {
  onClose: () => void; onCreate: () => void
  /** Pre-fill from a scanned label — still just a starting point, every field stays editable. */
  scanned?: ScannedMedication | null
  scanIssues?: string[]
}) {
  const [name,        setName]        = useState(scanned?.name ?? "")
  const [brand,       setBrand]       = useState(scanned?.brand_name ?? "")
  const [form,        setForm]        = useState(scanned?.dosage_form ?? "tablet")
  const [strength,    setStrength]    = useState(scanned?.strength ?? "")
  const [purpose,     setPurpose]     = useState(scanned?.purpose ?? "")
  const [isChronic,   setIsChronic]   = useState(false)
  const [times,       setTimes]       = useState(scanned?.times.length ? scanned.times : ["08:00"])
  const [doseQty,     setDoseQty]     = useState(String(scanned?.dose_qty ?? 1))
  const [mealRelation,setMealRelation]= useState<"before" | "after" | "with" | "any">(scanned?.meal_relation ?? "after")
  const [qty,         setQty]         = useState(scanned?.qty_total != null ? String(scanned.qty_total) : "")
  const [lowAlert,    setLowAlert]    = useState("7")
  const [expiry,      setExpiry]      = useState(scanned?.expiry_date ?? "")
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
            <h3 className="text-[17px] font-semibold">{scanned ? "ตรวจสอบก่อนบันทึก" : "เพิ่มยา"}</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>

          {scanned && (
            <div className="rounded-[10px] border border-brand-200 dark:border-brand-500/30 bg-brand-50/60 dark:bg-brand-500/5 p-3 space-y-1.5">
              <p className="text-[11.5px] font-semibold text-brand-700 dark:text-brand-400 flex items-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5" />อ่านจากฉลากยา — ตรวจให้ตรงกับซองยาก่อนบันทึก
              </p>
              {scanned.instructions_verbatim && (
                <p className="text-[11.5px] text-muted-foreground">&ldquo;{scanned.instructions_verbatim}&rdquo;</p>
              )}
              {(scanned.hospital_name || scanned.prescribing_doctor) && (
                <p className="text-[11px] text-muted-foreground">
                  {scanned.hospital_name}{scanned.hospital_name && scanned.prescribing_doctor ? " · " : ""}{scanned.prescribing_doctor}
                </p>
              )}
              {!scanned.times.length && (
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />อ่านช่วงเวลาไม่ได้ — ใส่เวลาแจ้งเตือนเองด้านล่าง
                </p>
              )}
              {scanIssues?.map((s, i) => (
                <p key={i} className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{s}
                </p>
              ))}
            </div>
          )}

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
                <select value={mealRelation} onChange={e => setMealRelation(e.target.value as typeof mealRelation)}
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
  const inv     = med.medication_inventory[0] ?? null
  const sched   = med.medication_schedules[0]
  const lowStock = isLowStock(inv)
  const expiring = isExpiringSoon(inv)
  const adherePct = adherence?.adherence_pct ?? null
  const daysLeft = daysRemaining(inv, sched)
  const outDate  = runOutDate(daysLeft)

  // Live market-price lookup — never cached on the medication itself (see
  // the pipeline's own note on why), so this is per-card local state,
  // fetched only when someone actually asks for it.
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceResult,  setPriceResult]  = useState<{ summary: string; sources: { title: string; url: string }[] } | null>(null)
  const [priceError,   setPriceError]   = useState<string | null>(null)

  const lookupPrice = async () => {
    setPriceLoading(true)
    setPriceError(null)
    try {
      const res = await fetch("/api/medications/price", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: med.name, strength: med.strength }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "ค้นหาราคาไม่สำเร็จ")
      setPriceResult(json)
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "ค้นหาราคาไม่สำเร็จ")
    } finally {
      setPriceLoading(false)
    }
  }

  // The label photo this medication was scanned or added from — GET
  // /api/medications/[id]/label resolves the stored path to a short-lived
  // signed URL, so nothing here ever holds a long-lived link to a private
  // file. hasLabel tracks the DB column so the upload/view affordance shows
  // the right state before the URL itself has been fetched.
  const [hasLabel,     setHasLabel]     = useState(!!med.image_url)
  const [labelUrl,     setLabelUrl]     = useState<string | null>(null)
  const [labelLoading, setLabelLoading] = useState(false)
  const labelInput = useRef<HTMLInputElement>(null)

  const viewLabel = async () => {
    setLabelLoading(true)
    try {
      const res = await fetch(`/api/medications/${med.id}/label`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "เปิดรูปไม่สำเร็จ")
      if (json.url) { setLabelUrl(json.url); window.open(json.url, "_blank", "noopener,noreferrer") }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เปิดรูปไม่สำเร็จ")
    } finally {
      setLabelLoading(false)
    }
  }

  const uploadLabel = async (file: File) => {
    setLabelLoading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/medications/${med.id}/label`, { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "อัปโหลดไม่สำเร็จ")
      setHasLabel(true)
      setLabelUrl(json.url)
      toast.success("อัปโหลดฉลากยาแล้ว")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ")
    } finally {
      setLabelLoading(false)
    }
  }

  const deleteLabel = async () => {
    setLabelLoading(true)
    try {
      const res = await fetch(`/api/medications/${med.id}/label`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error ?? "ลบไม่สำเร็จ")
      setHasLabel(false)
      setLabelUrl(null)
      toast.success("ลบรูปฉลากยาแล้ว")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ")
    } finally {
      setLabelLoading(false)
    }
  }

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
          {inv && (
            <span className={cn("text-xs", lowStock ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
              {inv.qty_remaining} {inv.qty_unit}
              {daysLeft != null && ` · เหลือ ${daysLeft} วัน`}
            </span>
          )}
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
          {daysLeft != null && sched && (
            <p className={cn(lowStock ? "text-rose-600 font-medium" : "text-muted-foreground")}>
              📦 ยาจะหมดในอีก {daysLeft} วัน (ประมาณ {outDate}) — จากอัตราทาน {sched.dose_qty * sched.times.length} เม็ด/วัน
            </p>
          )}
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

          <div className="border-t pt-2.5">
            <input ref={labelInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLabel(f); e.target.value = "" }} />
            {hasLabel ? (
              <div className="flex items-center gap-3">
                {labelUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element -- a signed URL to a private bucket, not a build-time asset */
                  <img src={labelUrl} alt="ฉลากยา" className="h-12 w-12 rounded-lg object-cover border shrink-0" />
                )}
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <button onClick={viewLabel} disabled={labelLoading} className="text-brand-600 hover:text-brand-700 disabled:opacity-60">
                    {labelLoading ? "กำลังเปิด…" : "🏷️ ดูฉลากยา"}
                  </button>
                  <button onClick={() => labelInput.current?.click()} disabled={labelLoading} className="text-muted-foreground hover:text-foreground disabled:opacity-60">
                    เปลี่ยนรูป
                  </button>
                  <button onClick={deleteLabel} disabled={labelLoading} className="text-rose-600 hover:text-rose-700 disabled:opacity-60">
                    ลบ
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => labelInput.current?.click()} disabled={labelLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-60">
                {labelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>🏷️</span>}
                {labelLoading ? "กำลังอัปโหลด…" : "อัปโหลดฉลากยา"}
              </button>
            )}
          </div>

          <div className="border-t pt-2.5">
            {!priceResult && (
              <button onClick={lookupPrice} disabled={priceLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-60">
                {priceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>💰</span>}
                {priceLoading ? "กำลังค้นหาราคาตลาด…" : "ค้นหาราคาตลาด"}
              </button>
            )}
            {priceError && <p className="text-xs text-rose-600 mt-1.5">{priceError}</p>}
            {priceResult && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <p className="text-xs text-foreground/80 whitespace-pre-line">{priceResult.summary}</p>
                {priceResult.sources.length > 0 && (
                  <div className="space-y-0.5">
                    {priceResult.sources.map(s => (
                      <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                        className="block text-[10px] text-brand-600 hover:underline truncate">🔗 {s.title || s.url}</a>
                    ))}
                  </div>
                )}
                <button onClick={lookupPrice} disabled={priceLoading}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">
                  {priceLoading ? "กำลังค้นหาใหม่…" : "↻ ค้นหาใหม่"}
                </button>
              </div>
            )}
          </div>
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

  // Scan-a-label flow: upload → propose (read-only) → the SAME add-medication
  // form, pre-filled, so nothing is ever written until it goes through the
  // one review step every path into `medications` already goes through.
  const [scanning,       setScanning]       = useState(false)
  const [scanResults,    setScanResults]    = useState<ScannedMedication[] | null>(null)
  const [scanIssues,     setScanIssues]     = useState<string[]>([])
  const [reviewing,      setReviewing]      = useState<ScannedMedication | null>(null)
  const scanInput = useRef<HTMLInputElement>(null)

  const scanLabel = async (file: File) => {
    setScanning(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/medications/scan", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "อ่านฉลากยาไม่สำเร็จ")
      const items = (json.items ?? []) as ScannedMedication[]
      setScanIssues((json.issues ?? []) as string[])
      if (!items.length) {
        toast.error("อ่านฉลากยาไม่พบรายการที่ใช้ได้")
        return
      }
      // One label, the common case: skip straight to the review form. More
      // than one (a photo catching two packs) shows a pick list first.
      if (items.length === 1) setReviewing(items[0])
      else setScanResults(items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อ่านฉลากยาไม่สำเร็จ")
    } finally {
      setScanning(false)
    }
  }

  // Reorder list: which medications are low or about to run out, and how
  // much to buy — computed server-side from the same daily-rate math the
  // card's own run-out estimate uses (GET /api/medications/reorder), then
  // optionally pushed to the user's own LINE as a message they can forward.
  const [reorderOpen,    setReorderOpen]    = useState(false)
  const [reorderLoading, setReorderLoading] = useState(false)
  const [reorderSending, setReorderSending] = useState(false)
  const [reorderItems,   setReorderItems]   = useState<ReorderItem[] | null>(null)

  const openReorder = async () => {
    setReorderOpen(true)
    setReorderLoading(true)
    try {
      const res = await fetch("/api/medications/reorder")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "โหลดรายการไม่สำเร็จ")
      setReorderItems(json.items as ReorderItem[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ")
      setReorderOpen(false)
    } finally {
      setReorderLoading(false)
    }
  }

  const sendReorderToLine = async () => {
    setReorderSending(true)
    try {
      const res = await fetch("/api/medications/reorder", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "ส่งไม่สำเร็จ")
      toast.success(`ส่งรายการสั่งซื้อ ${json.sent} รายการเข้า LINE แล้ว`)
      setReorderOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งไม่สำเร็จ")
    } finally {
      setReorderSending(false)
    }
  }

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
        <div className="flex items-center gap-2">
          <input ref={scanInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) scanLabel(f); e.target.value = "" }} />
          <button onClick={() => scanInput.current?.click()} disabled={scanning}
            className="h-9 px-4 rounded-[10px] border bg-card hover:bg-muted text-sm font-medium transition-colors inline-flex items-center gap-1.5 disabled:opacity-60">
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
            สแกนฉลากยา
          </button>
          <button onClick={openReorder}
            className="h-9 px-4 rounded-[10px] border bg-card hover:bg-muted text-sm font-medium transition-colors inline-flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" /> รายการสั่งซื้อ
          </button>
          <button onClick={() => setShowAdd(true)}
            className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> เพิ่มยา
          </button>
        </div>
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

      {reviewing && (
        <AddMedicationModal
          scanned={reviewing}
          scanIssues={scanResults ? undefined : scanIssues}
          onClose={() => { setReviewing(null); setScanResults(null) }}
          onCreate={() => window.location.reload()}
        />
      )}

      {/* A photo with more than one label in frame — pick which one to review first. */}
      {scanResults && !reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setScanResults(null)} />
          <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">พบยา {scanResults.length} รายการในภาพนี้</h3>
              <button onClick={() => setScanResults(null)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            {scanIssues.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-2.5 text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5">
                {scanIssues.map((s, i) => <p key={i} className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{s}</p>)}
              </div>
            )}
            <div className="space-y-2">
              {scanResults.map((item, i) => (
                <button key={i} onClick={() => setReviewing(item)}
                  className="w-full text-left rounded-xl border p-3 hover:bg-muted/40 transition-colors flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">💊</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.name}{item.strength ? ` ${item.strength}` : ""}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.times.length ? `${item.times.join(", ")} · ` : ""}{item.dose_qty} {item.qty_unit}/ครั้ง
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {reorderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReorderOpen(false)} />
          <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold flex items-center gap-1.5"><ShoppingCart className="w-4 h-4" />รายการสั่งซื้อยา</h3>
              <button onClick={() => setReorderOpen(false)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            {reorderLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : !reorderItems?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">ตอนนี้ยังไม่มียาที่ต้องสั่งซื้อเพิ่ม 🎉</p>
            ) : (
              <>
                <div className="space-y-2">
                  {reorderItems.map(it => (
                    <div key={it.medicationId} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{it.name}{it.strength ? ` ${it.strength}` : ""}</p>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                          it.reason === "running_out_soon" ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600" : "bg-amber-50 dark:bg-amber-500/10 text-amber-600")}>
                          {it.reason === "running_out_soon" ? `⏰ อีก ${it.daysRemaining} วันหมด` : "📦 เหลือน้อย"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        ตอนนี้เหลือ {it.qtyRemaining} {it.qtyUnit} · แนะนำซื้อ <span className="font-semibold text-foreground">{it.suggestedQty} {it.qtyUnit}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <button onClick={sendReorderToLine} disabled={reorderSending}
                  className="w-full h-10 rounded-[10px] bg-[#06C755] hover:brightness-95 text-white text-sm font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {reorderSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  ส่งรายการนี้ผ่าน LINE
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
