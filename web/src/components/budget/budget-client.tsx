"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Target, TrendingUp, AlertTriangle, CheckCircle, Edit3, X, Save, Loader2, Plus } from "lucide-react"

const CAT_TH: Record<string, { label: string; emoji: string }> = {
  tax_invoice_full:       { label: "ใบกำกับภาษีเต็ม",   emoji: "📋" },
  tax_invoice_simplified: { label: "ใบกำกับภาษีอย่างย่อ", emoji: "🧾" },
  receipt_with_tax:       { label: "ใบเสร็จ/ใบกำกับ",   emoji: "🧾" },
  receipt:                { label: "ใบเสร็จทั่วไป",      emoji: "📄" },
  consumer_receipt:       { label: "อาหาร/บริการ",       emoji: "🍽️" },
  invoice:                { label: "ใบแจ้งหนี้",         emoji: "📩" },
  credit_note:            { label: "ใบลดหนี้",           emoji: "↩️" },
  other:                  { label: "อื่นๆ",              emoji: "📁" },
}

const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]

function fmtTHB(n: number) { return "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) }
function fmtMonth(m: string) {
  const [y, mo] = m.split("-")
  return `${MONTH_TH[Number(mo) - 1]} ${Number(y) + 543}`
}

interface BudgetData {
  budget: { total: number; categories: Record<string, number> }
  spent:  { total: number; byCategory: Record<string, number> }
  month:  string
}

/* ─── Progress bar ─────────────────────────────────────────────────────────── */
function BudgetBar({ spent, budget, label, emoji }: { spent: number; budget: number; label: string; emoji?: string }) {
  const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const isOver = spent > budget && budget > 0
  const isWarn = pct >= 80 && !isOver

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {emoji && <span>{emoji}</span>}
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm", isOver ? "text-rose-600 font-bold" : isWarn ? "text-amber-600" : "text-muted-foreground")}>
            {fmtTHB(spent)}
          </span>
          {budget > 0 && <span className="text-xs text-muted-foreground">/ {fmtTHB(budget)}</span>}
          {isOver  && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
          {isWarn  && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          {!isOver && !isWarn && pct >= 1 && budget > 0 && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
        </div>
      </div>
      {budget > 0 && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500",
              isOver ? "bg-rose-500" : isWarn ? "bg-amber-400" : "bg-emerald-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Edit modal ────────────────────────────────────────────────────────────── */
function EditBudgetModal({ orgId, month, current, onClose, onSave }: {
  orgId:   string
  month:   string
  current: { total: number; categories: Record<string, number> }
  onClose: () => void
  onSave:  (data: BudgetData) => void
}) {
  const [total, setTotal] = useState(String(current.total || ""))
  const [cats,  setCats]  = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(current.categories).map(([k, v]) => [k, String(v)]))
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const categories: Record<string, number> = {}
      for (const [k, v] of Object.entries(cats)) {
        const n = Number(v)
        if (n > 0) categories[k] = n
      }
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, month, total: Number(total), categories }),
      })
      if (!res.ok) throw new Error("Save failed")

      // Refetch
      const upd = await fetch(`/api/budget?orgId=${orgId}&month=${month}`)
      if (upd.ok) onSave(await upd.json())
      toast.success("บันทึกงบประมาณแล้ว ✓")
      onClose()
    } catch { toast.error("บันทึกไม่สำเร็จ") }
    finally  { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-semibold">ตั้งงบประมาณ {fmtMonth(month)}</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">งบรวมทั้งเดือน (บาท)</label>
            <input type="number" min="0" value={total} onChange={e => setTotal(e.target.value)}
              placeholder="50,000"
              className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" />
          </div>

          <div className="space-y-3">
            <label className="block text-[11.5px] font-medium text-muted-foreground">งบแต่ละหมวดหมู่ (ไม่บังคับ)</label>
            {Object.entries(CAT_TH).map(([key, { label, emoji }]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-6 text-center text-sm">{emoji}</span>
                <span className="flex-1 text-sm text-muted-foreground">{label}</span>
                <input type="number" min="0" value={cats[key] ?? ""} onChange={e => setCats(p => ({ ...p, [key]: e.target.value }))}
                  placeholder="—"
                  className="w-28 h-8 rounded-[8px] border bg-background px-2.5 text-sm outline-none focus:border-brand-500" />
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 h-10 rounded-[10px] border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 h-10 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ──────────────────────────────────────────────────────────────────── */
export function BudgetClient({ orgId, initialData }: { orgId: string; initialData: BudgetData }) {
  const [data,      setData]      = useState(initialData)
  const [showEdit,  setShowEdit]  = useState(false)
  const { budget, spent, month }  = data

  const totalPct = budget.total > 0 ? Math.min((spent.total / budget.total) * 100, 100) : 0
  const isOver   = spent.total > budget.total && budget.total > 0
  const isWarn   = totalPct >= 80 && !isOver

  // All categories that have any spending or budget
  const allCats = Array.from(new Set([
    ...Object.keys(spent.byCategory),
    ...Object.keys(budget.categories),
  ]))

  return (
    <div className="p-6 lg:p-7 max-w-[800px] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">งบประมาณ</h2>
            <p className="text-muted-foreground text-sm">{fmtMonth(month)}</p>
          </div>
        </div>
        <button onClick={() => setShowEdit(true)}
          className="h-9 px-4 rounded-[10px] border bg-card hover:bg-muted text-sm font-medium transition-colors inline-flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5" /> ตั้งงบประมาณ
        </button>
      </div>

      {/* Total budget card */}
      <div className={cn(
        "rounded-xl border bg-card p-6 mb-6",
        isOver ? "border-rose-300 dark:border-rose-800" : isWarn ? "border-amber-300 dark:border-amber-800" : ""
      )}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">ค่าใช้จ่ายรวมเดือนนี้</p>
            <p className={cn("text-3xl font-black mt-1", isOver ? "text-rose-600" : "text-foreground")}>
              {fmtTHB(spent.total)}
            </p>
            {budget.total > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">จาก {fmtTHB(budget.total)} ที่ตั้งไว้</p>
            )}
          </div>
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black",
            isOver ? "bg-rose-100 text-rose-600 dark:bg-rose-500/10" :
            isWarn ? "bg-amber-100 text-amber-600 dark:bg-amber-500/10" :
            "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10"
          )}>
            {budget.total > 0 ? `${Math.round(totalPct)}%` : "—"}
          </div>
        </div>

        {budget.total > 0 && (
          <>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-700",
                isOver ? "bg-rose-500" : isWarn ? "bg-amber-400" : "bg-emerald-500")}
                style={{ width: `${totalPct}%` }} />
            </div>
            {isOver && (
              <p className="mt-2 text-xs text-rose-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                เกินงบ {fmtTHB(spent.total - budget.total)} บาท
              </p>
            )}
            {isWarn && !isOver && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                ใกล้ถึงงบ — เหลืออีก {fmtTHB(budget.total - spent.total)} บาท
              </p>
            )}
          </>
        )}

        {budget.total === 0 && (
          <button onClick={() => setShowEdit(true)}
            className="mt-2 flex items-center gap-1.5 text-sm text-brand-500 hover:text-brand-600 transition-colors">
            <Plus className="w-3.5 h-3.5" /> กดเพื่อตั้งงบประมาณ
          </button>
        )}
      </div>

      {/* Category breakdown */}
      {allCats.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            แยกตามหมวดหมู่
          </h3>
          <div className="space-y-5">
            {allCats.sort((a, b) => (spent.byCategory[b] ?? 0) - (spent.byCategory[a] ?? 0)).map(cat => {
              const info = CAT_TH[cat] ?? { label: cat, emoji: "📁" }
              return (
                <BudgetBar key={cat}
                  spent={spent.byCategory[cat] ?? 0}
                  budget={budget.categories[cat] ?? 0}
                  label={info.label}
                  emoji={info.emoji}
                />
              )
            })}
          </div>
        </div>
      )}

      {allCats.length === 0 && (
        <div className="rounded-xl border bg-card flex flex-col items-center py-14 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-2xl">📊</div>
          <p className="font-medium">ยังไม่มีค่าใช้จ่ายเดือนนี้</p>
          <p className="text-sm text-muted-foreground mt-1">อนุมัติเอกสารเพื่อดูสถิติรายจ่าย</p>
        </div>
      )}

      {showEdit && (
        <EditBudgetModal orgId={orgId} month={month} current={budget}
          onClose={() => setShowEdit(false)} onSave={setData} />
      )}
    </div>
  )
}
