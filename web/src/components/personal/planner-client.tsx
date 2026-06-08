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
  Plus, X, Target, Bell, CheckCircle2, XCircle,
  ChevronLeft, Calendar, TrendingUp,
} from "lucide-react"
import Link from "next/link"
import type { FinancialGoal, DetectedSubscription } from "@/app/(app)/personal/planner/page"

/* ─── Props ───────────────────────────────────────────────────────────────── */

export interface PlannerClientProps {
  goals:         FinancialGoal[]
  subscriptions: DetectedSubscription[]
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const fmtTHB = (n: number) =>
  "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
}

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const GOAL_CATEGORIES = [
  "เกษียณ", "บ้าน", "รถ", "การศึกษา", "ท่องเที่ยว",
  "สุขภาพ", "ลงทุน", "กองทุนฉุกเฉิน", "อื่นๆ",
]

const GOAL_CATEGORY_EMOJIS: Record<string, string> = {
  เกษียณ:       "🏖️",
  บ้าน:          "🏠",
  รถ:            "🚗",
  การศึกษา:     "📚",
  ท่องเที่ยว:   "✈️",
  สุขภาพ:       "❤️",
  ลงทุน:        "📈",
  กองทุนฉุกเฉิน: "🛡️",
  อื่นๆ:         "🎯",
}

const FREQ_LABELS: Record<string, string> = {
  monthly:  "รายเดือน",
  yearly:   "รายปี",
  weekly:   "รายสัปดาห์",
  quarterly: "รายไตรมาส",
}

/* ─── Goal progress card ──────────────────────────────────────────────────── */

function GoalCard({
  goal,
  onDelete,
}: {
  goal:     FinancialGoal
  onDelete: (id: string) => void
}) {
  const pct     = goal.target_amount > 0
    ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
    : 0
  const days    = goal.deadline ? daysLeft(goal.deadline) : null
  const overdue = days !== null && days < 0
  const emoji   = GOAL_CATEGORY_EMOJIS[goal.category ?? ""] ?? "🎯"

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-xl">
            {emoji}
          </div>
          <div>
            <p className="font-semibold text-sm">{goal.name}</p>
            {goal.category && (
              <p className="text-xs text-muted-foreground">{goal.category}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(goal.id)}
          className="p-1.5 text-muted-foreground hover:text-rose-500 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">{fmtTHB(goal.current_amount)} / {fmtTHB(goal.target_amount)}</span>
          <span className={cn(
            "text-xs font-semibold",
            pct >= 100 ? "text-emerald-500" : "text-sky-500"
          )}>{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              pct >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-sky-500 to-indigo-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {goal.deadline ? (
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{fmtDate(goal.deadline)}</span>
            {days !== null && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full font-medium",
                overdue
                  ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  : days <= 30
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {overdue ? `เกิน ${Math.abs(days)} วัน` : `${days} วัน`}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">ไม่มีกำหนด</span>
        )}
        {pct >= 100 && (
          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> สำเร็จ!
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Add goal modal ──────────────────────────────────────────────────────── */

function AddGoalModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd:   (goal: FinancialGoal) => void
}) {
  const [name,     setName]     = useState("")
  const [category, setCategory] = useState("")
  const [target,   setTarget]   = useState("")
  const [current,  setCurrent]  = useState("0")
  const [deadline, setDeadline] = useState("")
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !target) { toast.error("กรุณากรอกข้อมูลที่จำเป็น"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/personal/goals", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:           name.trim(),
          category:       category || null,
          target_amount:  Number(target),
          current_amount: Number(current) || 0,
          deadline:       deadline || null,
          status:         "active",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด")
      onAdd({
        id:             data.id ?? crypto.randomUUID(),
        name:           name.trim(),
        category:       category || null,
        target_amount:  Number(target),
        current_amount: Number(current) || 0,
        deadline:       deadline || null,
        status:         "active",
      })
      toast.success("สร้างเป้าหมายแล้ว")
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-[16px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-[17px] font-semibold">เพิ่มเป้าหมาย</h3>
              <p className="text-xs text-muted-foreground mt-0.5">ตั้งเป้าหมายทางการเงิน</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">ชื่อเป้าหมาย *</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น ดาวน์บ้าน, กองทุนฉุกเฉิน"
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                  outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">หมวดหมู่</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                  outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition"
              >
                <option value="">เลือกหมวดหมู่</option>
                {GOAL_CATEGORIES.map(c => (
                  <option key={c} value={c}>{GOAL_CATEGORY_EMOJIS[c]} {c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">เป้าหมาย (฿) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                    outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">มีแล้ว (฿)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                    outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">กำหนดเวลา</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                  outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="h-9 px-4 rounded-[10px] hover:bg-muted text-sm font-medium transition-colors">
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-9 px-5 rounded-[10px] bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loading ? "กำลังสร้าง..." : "สร้างเป้าหมาย"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ─── Subscription row ────────────────────────────────────────────────────── */

function SubRow({
  sub,
  onConfirm,
  onDismiss,
}: {
  sub:       DetectedSubscription
  onConfirm: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const days    = sub.next_due_date ? daysLeft(sub.next_due_date) : null
  const overdue = days !== null && days < 0

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-base">
        📲
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{sub.vendor_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{FREQ_LABELS[sub.frequency] ?? sub.frequency}</span>
          {sub.next_due_date && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className={cn(
                "text-xs",
                overdue ? "text-red-500" : days !== null && days <= 7 ? "text-amber-500" : "text-muted-foreground"
              )}>
                ถัดไป {fmtDate(sub.next_due_date)}
                {days !== null && ` (${overdue ? "เกิน" : ""} ${Math.abs(days)} วัน)`}
              </span>
            </>
          )}
        </div>
      </div>
      <p className="text-sm font-semibold shrink-0">{fmtTHB(sub.estimated_amount)}</p>
      {!sub.is_confirmed && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onConfirm(sub.id)}
            className="h-8 w-8 rounded-[8px] bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
            title="ยืนยัน"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDismiss(sub.id)}
            className="h-8 w-8 rounded-[8px] bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-colors"
            title="ยกเลิก"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      {sub.is_confirmed && (
        <span className="text-xs text-emerald-500 font-medium shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> ยืนยันแล้ว
        </span>
      )}
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function PlannerClient({ goals: initialGoals, subscriptions: initialSubs }: PlannerClientProps) {
  const [goals,      setGoals]      = useState<FinancialGoal[]>(initialGoals)
  const [subs,       setSubs]       = useState<DetectedSubscription[]>(initialSubs)
  const [showModal,  setShowModal]  = useState(false)

  const activeGoals   = goals.filter(g => g.status === "active")
  const pendingSubs   = subs.filter(s => !s.is_confirmed)
  const confirmedSubs = subs.filter(s => s.is_confirmed)
  const monthlyTotal  = confirmedSubs.reduce((sum, s) => {
    if (s.frequency === "monthly")  return sum + s.estimated_amount
    if (s.frequency === "yearly")   return sum + s.estimated_amount / 12
    if (s.frequency === "weekly")   return sum + s.estimated_amount * 4.33
    if (s.frequency === "quarterly") return sum + s.estimated_amount / 3
    return sum
  }, 0)

  const handleAddGoal = (goal: FinancialGoal) => {
    setGoals(prev => [goal, ...prev])
  }

  const handleDeleteGoal = async (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id))
    try {
      await fetch("/api/personal/goals", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
    } catch { /* best-effort */ }
    toast.success("ลบเป้าหมายแล้ว")
  }

  const handleConfirmSub = async (id: string) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, is_confirmed: true } : s))
    try {
      const res = await fetch("/api/personal/subscriptions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "confirm" }),
      })
      if (!res.ok) throw new Error()
      toast.success("ยืนยัน subscription แล้ว")
    } catch {
      setSubs(prev => prev.map(s => s.id === id ? { ...s, is_confirmed: false } : s))
      toast.error("ไม่สามารถยืนยันได้")
    }
  }

  const handleDismissSub = async (id: string) => {
    setSubs(prev => prev.filter(s => s.id !== id))
    try {
      await fetch("/api/personal/subscriptions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "dismiss" }),
      })
      toast.success("ยกเลิก subscription แล้ว")
    } catch { /* best-effort */ }
  }

  return (
    <div className="p-6 lg:p-7 max-w-[960px] animate-fade-in">

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/personal"
            className="h-9 w-9 rounded-[10px] border border-border hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Life Planner</h2>
            <p className="text-muted-foreground text-sm">เป้าหมายการเงิน · subscription tracker</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="h-9 px-4 rounded-[10px] bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium
            transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> เพิ่มเป้าหมาย
        </button>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border bg-card p-5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center mb-3">
            <Target className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold">{activeGoals.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">เป้าหมาย active</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
            <Bell className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold">{pendingSubs.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">subscription รอยืนยัน</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold">{fmtTHB(Math.round(monthlyTotal))}</p>
          <p className="text-xs text-muted-foreground mt-0.5">subscription รายเดือน (ประมาณ)</p>
        </div>
      </div>

      {/* ── Financial Goals ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">เป้าหมายทางการเงิน ({activeGoals.length})</h3>
        </div>
        {activeGoals.length === 0 ? (
          <div className="rounded-2xl border bg-card flex flex-col items-center justify-center py-12 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-2xl">
              🎯
            </div>
            <p className="font-medium">ยังไม่มีเป้าหมาย</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              ตั้งเป้าหมายทางการเงินเพื่อติดตามความก้าวหน้า
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 h-9 px-5 rounded-[10px] bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
            >
              สร้างเป้าหมายแรก
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {activeGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} onDelete={handleDeleteGoal} />
            ))}
          </div>
        )}
      </div>

      {/* ── Subscription Tracker ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Subscription Tracker</h3>
          {pendingSubs.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-medium">
              {pendingSubs.length} รอยืนยัน
            </span>
          )}
        </div>
        <div className="rounded-2xl border bg-card overflow-hidden">
          {subs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-2xl">
                📲
              </div>
              <p className="font-medium">ยังไม่พบ subscription</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                ระบบจะตรวจจับ subscription อัตโนมัติจากใบเสร็จของคุณ
              </p>
            </div>
          ) : (
            <div>
              {pendingSubs.length > 0 && (
                <>
                  <div className="px-5 py-2.5 bg-amber-50/50 dark:bg-amber-500/5 border-b border-border">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">รอการยืนยัน</p>
                  </div>
                  <div className="divide-y divide-border">
                    {pendingSubs.map(sub => (
                      <SubRow
                        key={sub.id}
                        sub={sub}
                        onConfirm={handleConfirmSub}
                        onDismiss={handleDismissSub}
                      />
                    ))}
                  </div>
                </>
              )}
              {confirmedSubs.length > 0 && (
                <>
                  <div className="px-5 py-2.5 bg-muted/20 border-t border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground">ยืนยันแล้ว ({confirmedSubs.length})</p>
                  </div>
                  <div className="divide-y divide-border">
                    {confirmedSubs.map(sub => (
                      <SubRow
                        key={sub.id}
                        sub={sub}
                        onConfirm={handleConfirmSub}
                        onDismiss={handleDismissSub}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <AddGoalModal
          onClose={() => setShowModal(false)}
          onAdd={handleAddGoal}
        />
      )}
    </div>
  )
}
