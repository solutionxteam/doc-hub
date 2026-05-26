"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Users, Receipt, QrCode, SplitSquareHorizontal,
  Plus, Trash2, X, Check, ChevronRight, UserPlus,
  Clock, CheckCircle2, FileText,
} from "lucide-react"

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type Participant = {
  id:     string
  name:   string
  email:  string | null
  amount: number
  paid_at:string | null
}

export type SplitBill = {
  id:           string
  title:        string
  total_amount: number
  note:         string | null
  created_at:   string
  document_id:  string | null
  split_participants: Participant[]
}

export interface SplitClientProps {
  orgId: string
  bills: SplitBill[]
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const fmtTHB = (n: number) =>
  "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
}

/* ─── Bill card ───────────────────────────────────────────────────────────── */

function BillCard({ bill, onMarkPaid, onDelete }: {
  bill:       SplitBill
  onMarkPaid: (billId: string, participantId: string, paid: boolean) => void
  onDelete:   (billId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const total    = bill.split_participants.length
  const settled  = bill.split_participants.filter(p => p.paid_at).length
  const pending  = total - settled
  const pctDone  = total > 0 ? (settled / total) * 100 : 0

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
          🧾
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{bill.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} คน · {fmtDate(bill.created_at)}
          </p>
          {total > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden w-[100px]">
                <div
                  className={cn("h-full rounded-full transition-all", pctDone >= 100 ? "bg-emerald-500" : "bg-brand-500")}
                  style={{ width: `${pctDone}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{settled}/{total} จ่ายแล้ว</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold text-sm">{fmtTHB(Number(bill.total_amount))}</p>
          {pending > 0 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-medium">
              ค้าง {pending} คน
            </span>
          ) : total > 0 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 font-medium">
              ครบแล้ว ✓
            </span>
          ) : null}
        </div>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", expanded && "rotate-90")} />
      </button>

      {/* Expanded participants */}
      {expanded && (
        <div className="border-t divide-y divide-border">
          {bill.note && (
            <div className="px-5 py-2.5 text-xs text-muted-foreground bg-muted/30 italic">
              {bill.note}
            </div>
          )}
          {bill.split_participants.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {p.name[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.name}</p>
                {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
              </div>
              <p className="text-sm font-semibold shrink-0">{fmtTHB(Number(p.amount))}</p>
              <button
                onClick={() => onMarkPaid(bill.id, p.id, !p.paid_at)}
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0",
                  p.paid_at
                    ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                title={p.paid_at ? "ยกเลิกการจ่าย" : "ทำเครื่องหมายว่าจ่ายแล้ว"}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {bill.split_participants.length === 0 && (
            <div className="px-5 py-6 text-center text-muted-foreground text-sm">
              ยังไม่มีผู้เข้าร่วม
            </div>
          )}

          {/* Footer: delete */}
          <div className="px-5 py-3 flex items-center justify-between bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {fmtDate(bill.created_at)}
            </span>
            <button
              onClick={() => onDelete(bill.id)}
              className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> ลบบิล
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Create bill modal ───────────────────────────────────────────────────── */

type ParticipantInput = { name: string; email: string; amount: string }

function CreateBillModal({ orgId, onClose, onCreate }: {
  orgId:    string
  onClose:  () => void
  onCreate: (bill: SplitBill) => void
}) {
  const [title,   setTitle]   = useState("")
  const [total,   setTotal]   = useState("")
  const [note,    setNote]    = useState("")
  const [people,  setPeople]  = useState<ParticipantInput[]>([
    { name:"", email:"", amount:"" },
    { name:"", email:"", amount:"" },
  ])
  const [loading, setLoading] = useState(false)

  const addPerson = () => setPeople(p => [...p, { name:"", email:"", amount:"" }])
  const removePerson = (i: number) => setPeople(p => p.filter((_, idx) => idx !== i))

  const splitEvenly = () => {
    const n = people.length
    if (!n || !total) return
    const each = (Number(total) / n).toFixed(2)
    setPeople(p => p.map(pp => ({ ...pp, amount: each })))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validPeople = people.filter(p => p.name.trim())
    if (!validPeople.length) { toast.error("กรอกชื่อผู้เข้าร่วมอย่างน้อย 1 คน"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/split", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orgId,
          title:        title.trim(),
          totalAmount:  Number(total),
          note:         note.trim() || undefined,
          participants: validPeople.map(p => ({
            name:   p.name.trim(),
            email:  p.email.trim() || undefined,
            amount: Number(p.amount) || 0,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Optimistic local bill object
      const newBill: SplitBill = {
        id:           data.billId,
        title:        title.trim(),
        total_amount: Number(total),
        note:         note.trim() || null,
        created_at:   new Date().toISOString(),
        document_id:  null,
        split_participants: validPeople.map((p, i) => ({
          id:      `temp-${i}`,
          name:    p.name.trim(),
          email:   p.email.trim() || null,
          amount:  Number(p.amount) || 0,
          paid_at: null,
        })),
      }
      onCreate(newBill)
      toast.success("สร้างบิลเรียบร้อย")
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? "เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-[16px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-[17px] font-semibold">สร้างบิลใหม่</h3>
              <p className="text-xs text-muted-foreground mt-0.5">แชร์ค่าใช้จ่ายกับผู้เข้าร่วม</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Bill title */}
            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">ชื่อบิล *</label>
              <input
                required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="เช่น อาหารเย็น MK EmQuartier"
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                  outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition"
              />
            </div>

            {/* Total + split evenly */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">ยอดรวม (฿) *</label>
                <input
                  required type="number" min="0" step="0.01" value={total} onChange={e => setTotal(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                    outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button" onClick={splitEvenly}
                  className="h-10 px-3 rounded-[10px] border border-border text-xs font-medium hover:bg-muted transition-colors"
                >
                  หารเท่ากัน
                </button>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">หมายเหตุ</label>
              <input
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม (ไม่จำเป็น)"
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                  outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition"
              />
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11.5px] font-medium text-muted-foreground">ผู้เข้าร่วม</label>
                <button type="button" onClick={addPerson} className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                  <UserPlus className="w-3 h-3" /> เพิ่มคน
                </button>
              </div>
              <div className="space-y-2">
                {people.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                      {i + 1}
                    </div>
                    <input
                      value={p.name} onChange={e => setPeople(pp => pp.map((x, j) => j===i ? {...x, name:e.target.value} : x))}
                      placeholder="ชื่อ"
                      className="flex-1 h-9 px-2.5 rounded-[8px] border border-border bg-background text-sm
                        outline-none focus:border-brand-500 transition"
                    />
                    <input
                      type="number" min="0" step="0.01"
                      value={p.amount} onChange={e => setPeople(pp => pp.map((x, j) => j===i ? {...x, amount:e.target.value} : x))}
                      placeholder="฿"
                      className="w-20 h-9 px-2.5 rounded-[8px] border border-border bg-background text-sm
                        outline-none focus:border-brand-500 transition"
                    />
                    {people.length > 1 && (
                      <button type="button" onClick={() => removePerson(i)} className="p-1.5 text-muted-foreground hover:text-rose-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="h-9 px-4 rounded-[10px] hover:bg-muted text-sm font-medium text-foreground transition-colors">
                ยกเลิก
              </button>
              <button
                type="submit" disabled={loading || !title || !total}
                className="h-9 px-5 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loading ? "กำลังสร้าง..." : "สร้างบิล"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function SplitClient({ orgId, bills: initialBills }: SplitClientProps) {
  const [bills,     setBills]     = useState<SplitBill[]>(initialBills)
  const [showModal, setShowModal] = useState(false)

  // Derived stats
  const activeBills   = bills.filter(b => b.split_participants.some(p => !p.paid_at))
  const pendingPeople = bills.reduce((s, b) => s + b.split_participants.filter(p => !p.paid_at).length, 0)
  const pendingAmount = bills.reduce((s, b) =>
    s + b.split_participants.filter(p => !p.paid_at).reduce((ss, p) => ss + Number(p.amount), 0), 0
  )

  const handleMarkPaid = async (billId: string, participantId: string, paid: boolean) => {
    // Optimistic update
    setBills(prev => prev.map(b => b.id !== billId ? b : {
      ...b,
      split_participants: b.split_participants.map(p =>
        p.id !== participantId ? p : { ...p, paid_at: paid ? new Date().toISOString() : null }
      ),
    }))
    try {
      const res = await fetch("/api/split", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ participantId, paid }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on error
      setBills(prev => prev.map(b => b.id !== billId ? b : {
        ...b,
        split_participants: b.split_participants.map(p =>
          p.id !== participantId ? p : { ...p, paid_at: paid ? null : new Date().toISOString() }
        ),
      }))
      toast.error("ไม่สามารถอัปเดตสถานะได้")
    }
  }

  const handleDelete = async (billId: string) => {
    setBills(prev => prev.filter(b => b.id !== billId))
    try {
      await fetch("/api/split", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ billId }),
      })
    } catch { /* best-effort */ }
    toast.success("ลบบิลแล้ว")
  }

  const handleCreate = (newBill: SplitBill) => {
    setBills(prev => [newBill, ...prev])
  }

  return (
    <div className="p-6 lg:p-7 max-w-[960px] animate-fade-in">

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <SplitSquareHorizontal className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">หารบิล</h2>
            <p className="text-muted-foreground text-sm">แชร์ค่าใช้จ่ายกับเพื่อนง่ายๆ</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium
            transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> สร้างบิลใหม่
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "บิลที่ค้างอยู่",
            value: activeBills.length.toString(),
            icon:  Receipt,
            color: "text-brand-500",
            bg:    "bg-brand-500/10",
          },
          {
            label: "คนค้างจ่าย",
            value: pendingPeople.toString(),
            icon:  Users,
            color: "text-amber-500",
            bg:    "bg-amber-500/10",
          },
          {
            label: "ยอดรอรับ",
            value: fmtTHB(pendingAmount),
            icon:  QrCode,
            color: "text-emerald-500",
            bg:    "bg-emerald-500/10",
          },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className={`w-9 h-9 rounded-[10px] ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Bills list ── */}
      {bills.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <SplitSquareHorizontal className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">ยังไม่มีบิล</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            กดปุ่ม "สร้างบิลใหม่" เพื่อแชร์ค่าใช้จ่ายกับเพื่อนหรือทีม
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-5 h-9 px-5 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            สร้างบิลแรก
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">บิลทั้งหมด ({bills.length})</h3>
          </div>
          {bills.map(bill => (
            <BillCard
              key={bill.id}
              bill={bill}
              onMarkPaid={handleMarkPaid}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Create modal ── */}
      {showModal && (
        <CreateBillModal
          orgId={orgId}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
