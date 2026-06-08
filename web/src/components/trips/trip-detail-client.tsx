"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  ArrowLeft, Plus, Check, X, Copy, ExternalLink,
  Receipt, Users, ChevronDown, ChevronUp, Loader2,
  QrCode, AlertCircle, DollarSign, Clock, CheckCircle2,
} from "lucide-react"

type Participant = {
  id: string; display_name: string; is_host: boolean
  amount_owed: number; amount_paid: number; paid_at: string | null
  line_user_id: string | null; promptpay_type: string | null
  promptpay_value: string | null; qr_image_url: string | null
}
type Expense = {
  id: string; title: string; amount: number; category: string | null
  split_mode: string; note: string | null; expense_date: string; paid_by_id: string
  trip_participants: { id: string; display_name: string }
  expense_splits: Array<{ participant_id: string; amount: number; is_paid: boolean }>
}
type Payment = {
  id: string; from_participant: string; to_participant: string
  amount: number; slip_url: string | null; status: string
  paid_at: string; note: string | null
}
type Settlement = { from_name: string; to_name: string; amount: number; from_id: string; to_id: string }

const fmtTHB  = (n: number) => "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" })
const CAT_EMOJI: Record<string, string> = { food: "🍽️", transport: "🚗", accommodation: "🏨", activity: "🎯", other: "💰" }

/* ─── Add Expense Modal ─────────────────────────────────────────────────────── */
function AddExpenseModal({ tripId, participants, onClose, onAdd }: {
  tripId: string; participants: Participant[]
  onClose: () => void; onAdd: (e: Expense) => void
}) {
  const [title,    setTitle]    = useState("")
  const [amount,   setAmount]   = useState("")
  const [paidBy,   setPaidBy]   = useState(participants.find(p => p.is_host)?.id ?? participants[0]?.id ?? "")
  const [category, setCategory] = useState("food")
  const [note,     setNote]     = useState("")
  const [splitMode,setSplitMode]= useState<"equal"|"individual">("equal")
  const [saving,   setSaving]   = useState(false)

  const handleAdd = async () => {
    if (!title.trim() || !amount) { toast.error("กรอกชื่อรายการและจำนวนเงิน"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, amount: Number(amount), paid_by_id: paidBy, category, note: note || null, split_mode: splitMode }),
      })
      if (!res.ok) throw new Error()
      toast.success("เพิ่มรายจ่ายแล้ว")
      window.location.reload()
    } catch { toast.error("เกิดข้อผิดพลาด") } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-md">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-semibold">เพิ่มค่าใช้จ่าย</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">รายการ *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ค่าอาหาร, ค่าโรงแรม, ..."
              className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">จำนวน (บาท) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">หมวด</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500">
                {Object.entries(CAT_EMOJI).map(([k]) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ใครจ่ายก่อน</label>
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)}
              className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500">
              {participants.map(p => <option key={p.id} value={p.id}>{p.display_name}{p.is_host ? " (เจ้าภาพ)" : ""}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: "equal", label: "หารเท่า" }, { id: "individual", label: "ตามจริง" }].map(m => (
              <button key={m.id} onClick={() => setSplitMode(m.id as any)}
                className={cn("h-9 rounded-[8px] border text-sm font-medium transition-colors",
                  splitMode === m.id ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600" : "hover:bg-muted/50")}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 h-10 rounded-[10px] border text-sm font-medium hover:bg-muted">ยกเลิก</button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 h-10 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} เพิ่มรายการ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Payment Modal ──────────────────────────────────────────────────────────── */
function PaymentModal({ tripId, from, to, amount, onClose, onPaid }: {
  tripId: string; from: Participant; to: Participant; amount: number
  onClose: () => void; onPaid: () => void
}) {
  const [note,    setNote]    = useState("")
  const [saving,  setSaving]  = useState(false)

  const handlePay = async () => {
    setSaving(true)
    try {
      await fetch(`/api/trips/${tripId}/pay`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_participant: from.id, to_participant: to.id, amount, note: note || null }),
      })
      toast.success("บันทึกการจ่ายแล้ว — รอผู้รับยืนยัน")
      onPaid()
      onClose()
    } catch { toast.error("เกิดข้อผิดพลาด") } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-sm">
        <div className="p-6 space-y-4">
          <h3 className="text-[17px] font-semibold">จ่ายเงิน</h3>
          <div className="p-4 bg-muted/40 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">{from.display_name} → {to.display_name}</p>
            <p className="text-3xl font-black mt-1 text-brand-600">{fmtTHB(amount)}</p>
          </div>

          {/* Show QR if available */}
          {to.qr_image_url ? (
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">สแกน QR เพื่อโอนเงิน</p>
              <img src={to.qr_image_url} alt="QR" className="w-48 h-48 mx-auto rounded-xl border object-contain" />
              <p className="text-xs font-medium">{to.display_name}</p>
            </div>
          ) : to.promptpay_value ? (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-center">
              <p className="text-xs text-muted-foreground mb-1">PromptPay</p>
              <p className="font-bold text-lg">{to.promptpay_value}</p>
              <button onClick={() => { navigator.clipboard.writeText(to.promptpay_value!); toast.success("คัดลอกแล้ว") }}
                className="mt-2 text-xs text-brand-500 flex items-center gap-1 mx-auto">
                <Copy className="w-3 h-3" /> คัดลอกเบอร์
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">ไม่มีข้อมูล PromptPay — ติดต่อผู้รับโดยตรง</p>
          )}

          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">หมายเหตุ (ไม่บังคับ)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="โอนแล้วนะ..."
              className="w-full h-9 rounded-[8px] border bg-background px-2 text-sm outline-none focus:border-brand-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 h-10 rounded-[10px] border text-sm font-medium hover:bg-muted">ยกเลิก</button>
            <button onClick={handlePay} disabled={saving}
              className="flex-1 h-10 rounded-[10px] bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} ฉันโอนแล้ว ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────────── */
export function TripDetailClient({ trip, expenses, payments, settlement, orgId }: {
  trip: any; expenses: Expense[]; payments: Payment[]; settlement: Settlement[]; orgId: string
}) {
  const router = useRouter()
  const [showAdd,    setShowAdd]    = useState(false)
  const [payModal,   setPayModal]   = useState<{ from: Participant; to: Participant; amount: number } | null>(null)
  const [expandedExp, setExpandedExp] = useState<string | null>(null)
  const [tab,        setTab]        = useState<"expenses"|"settlement"|"payments">("expenses")

  const participants: Participant[] = trip.trip_participants ?? []
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalPaid     = participants.reduce((s, p) => s + Number(p.amount_paid), 0)
  const totalOwed     = participants.reduce((s, p) => s + Number(p.amount_owed), 0)
  const isSettled     = settlement.length === 0 && totalExpenses > 0

  const shareUrl = trip.share_token
    ? (process.env.NEXT_PUBLIC_LIFF_ID
        ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/liff/join/${trip.share_token}?type=trip`
        : `${typeof window !== "undefined" ? window.location.origin : ""}/liff/join/${trip.share_token}?type=trip`)
    : null

  const pMap = Object.fromEntries(participants.map(p => [p.id, p]))

  const confirmPayment = async (paymentId: string) => {
    await fetch(`/api/trips/${trip.id}/pay`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, action: "confirm" }),
    })
    toast.success("ยืนยันแล้ว ✓")
    window.location.reload()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-7 max-w-[900px] animate-fade-in">
      {/* Back + Header */}
      <button onClick={() => router.push("/trips")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> กลับ
      </button>

      <div className="rounded-xl border bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/5 dark:to-indigo-500/5 p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/80 dark:bg-white/10 flex items-center justify-center text-2xl shadow-sm">
              {trip.cover_emoji}
            </div>
            <div>
              <h2 className="text-xl font-bold">{trip.title}</h2>
              <p className="text-sm text-muted-foreground">
                {trip.venue ?? trip.destination ?? ""} · {participants.length} คน
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {shareUrl && (
              <button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("คัดลอกลิงก์เชิญแล้ว") }}
                className="h-8 px-3 rounded-[8px] border bg-white/80 dark:bg-white/10 text-xs font-medium flex items-center gap-1.5 hover:bg-white transition-colors">
                <Copy className="w-3 h-3" /> เชิญเพื่อน
              </button>
            )}
            <button onClick={() => setShowAdd(true)}
              className="h-8 px-3 rounded-[8px] bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors">
              <Plus className="w-3 h-3" /> เพิ่มรายจ่าย
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "รายจ่ายรวม", value: fmtTHB(totalExpenses), color: "text-foreground" },
            { label: "จ่ายแล้ว",    value: fmtTHB(totalPaid),    color: "text-emerald-600" },
            { label: "ยังค้าง",      value: fmtTHB(Math.max(0, totalOwed - totalPaid)), color: "text-amber-600" },
          ].map(s => (
            <div key={s.label} className="text-center bg-white/60 dark:bg-white/5 rounded-xl p-2.5">
              <p className={cn("text-lg font-black", s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b mb-4">
        {[
          { id: "expenses",   label: `รายจ่าย (${expenses.length})` },
          { id: "settlement", label: `สรุปการจ่าย ${isSettled ? "✅" : `(${settlement.length})`}` },
          { id: "payments",   label: `ประวัติโอน (${payments.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn("px-4 h-10 text-[13px] font-medium border-b-2 -mb-px transition whitespace-nowrap",
              tab === t.id ? "border-brand-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Expenses tab */}
      {tab === "expenses" && (
        <div className="space-y-2">
          {expenses.length === 0 ? (
            <div className="rounded-xl border bg-card py-12 text-center">
              <p className="text-3xl mb-2">🧾</p>
              <p className="font-medium">ยังไม่มีรายจ่าย</p>
              <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-brand-500">+ เพิ่มรายจ่าย</button>
            </div>
          ) : expenses.map(e => (
            <div key={e.id} className="rounded-xl border bg-card overflow-hidden">
              <button onClick={() => setExpandedExp(expandedExp === e.id ? null : e.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/20">
                <span className="text-lg">{CAT_EMOJI[e.category ?? "other"] ?? "💰"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{(e.trip_participants as any)?.display_name} จ่าย · {fmtDate(e.expense_date)}</p>
                </div>
                <p className="font-bold shrink-0">{fmtTHB(e.amount)}</p>
                {expandedExp === e.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expandedExp === e.id && (
                <div className="border-t px-4 py-3 bg-muted/10">
                  <p className="text-xs text-muted-foreground mb-2">แบ่งกัน {e.split_mode === "equal" ? "เท่ากัน" : "ตามจริง"}</p>
                  <div className="space-y-1">
                    {(e.expense_splits ?? []).map(s => {
                      const p = pMap[s.participant_id]
                      return (
                        <div key={s.participant_id} className="flex items-center justify-between text-xs">
                          <span className={s.is_paid ? "line-through text-muted-foreground" : ""}>{p?.display_name ?? "—"}</span>
                          <span className={cn("font-semibold", s.is_paid ? "text-emerald-600" : "text-foreground")}>{fmtTHB(s.amount)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Settlement tab */}
      {tab === "settlement" && (
        <div className="space-y-3">
          {isSettled ? (
            <div className="rounded-xl border bg-card py-12 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-bold text-lg text-emerald-600">เคลียร์แล้วทุกคน!</p>
              <p className="text-sm text-muted-foreground mt-1">ทุกรายการถูกชำระครบแล้ว</p>
            </div>
          ) : settlement.length === 0 && totalExpenses === 0 ? (
            <div className="rounded-xl border bg-card py-10 text-center text-muted-foreground text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <>
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>ด้านล่างคือการโอนที่น้อยที่สุดเพื่อเคลียร์หนี้ทั้งหมด — กดที่รายการเพื่อเริ่มจ่าย</span>
              </div>
              {settlement.map((s, i) => {
                const from = participants.find(p => p.id === s.from_id)
                const to   = participants.find(p => p.id === s.to_id)
                const alreadyPaid = payments.some(p => p.from_participant === s.from_id && p.to_participant === s.to_id && p.status === "confirmed")
                return (
                  <button key={i} onClick={() => from && to && setPayModal({ from, to, amount: s.amount })}
                    disabled={alreadyPaid}
                    className={cn("w-full rounded-xl border bg-card p-4 text-left hover:shadow-sm transition-all",
                      alreadyPaid ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/20")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-xs font-bold">
                          {s.from_name[0]}
                        </div>
                        <span className="font-medium">{s.from_name}</span>
                        <span className="text-muted-foreground">→</span>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                          {s.to_name[0]}
                        </div>
                        <span className="font-medium">{s.to_name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-600">{fmtTHB(s.amount)}</p>
                        {alreadyPaid
                          ? <span className="text-[10px] text-emerald-600">ยืนยันแล้ว ✓</span>
                          : <span className="text-[10px] text-muted-foreground">แตะเพื่อจ่าย</span>}
                      </div>
                    </div>
                    {/* Show QR hint */}
                    {to?.qr_image_url && !alreadyPaid && (
                      <p className="text-[11px] text-brand-500 mt-1.5 flex items-center gap-1"><QrCode className="w-3 h-3" /> มี QR PromptPay</p>
                    )}
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Payments history tab */}
      {tab === "payments" && (
        <div className="space-y-2">
          {payments.length === 0 ? (
            <div className="rounded-xl border bg-card py-10 text-center text-muted-foreground text-sm">ยังไม่มีประวัติการโอน</div>
          ) : payments.map(p => {
            const from = pMap[p.from_participant]
            const to   = pMap[p.to_participant]
            return (
              <div key={p.id} className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                  p.status === "confirmed" ? "bg-emerald-100 dark:bg-emerald-500/20" : p.status === "disputed" ? "bg-rose-100 dark:bg-rose-500/20" : "bg-amber-100 dark:bg-amber-500/20")}>
                  {p.status === "confirmed" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : p.status === "disputed" ? <X className="w-4 h-4 text-rose-600" /> : <Clock className="w-4 h-4 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{from?.display_name ?? "—"} → {to?.display_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(p.paid_at)} · {p.status === "confirmed" ? "ยืนยันแล้ว" : p.status === "disputed" ? "มีข้อพิพาท" : "รอยืนยัน"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold">{fmtTHB(p.amount)}</p>
                  {p.status === "pending" && to?.display_name && (
                    <button onClick={() => confirmPayment(p.id)}
                      className="text-[10px] text-emerald-600 hover:underline mt-0.5 block">ยืนยันรับ</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddExpenseModal tripId={trip.id} participants={participants} onClose={() => setShowAdd(false)} onAdd={() => {}} />}
      {payModal && (
        <PaymentModal tripId={trip.id} from={payModal.from} to={payModal.to} amount={payModal.amount}
          onClose={() => setPayModal(null)} onPaid={() => setPayModal(null)} />
      )}
    </div>
  )
}
