"use client"

/**
 * Personal Tax Client — ภ.ง.ด.90 / ภ.ง.ด.91
 *
 * ช่วย:
 *   1. ประมาณภาษีเงินได้บุคคลธรรมดาจากรายจ่ายที่บันทึกไว้
 *   2. แสดงค่าใช้จ่ายที่นำมาลดหย่อนได้ (expense deductions)
 *   3. Export สรุปเพื่อใช้กับสรรพากรหรือผู้ทำบัญชี
 *
 * หมายเหตุ: ตัวเลขภาษีเป็นการประมาณการเท่านั้น ควรปรึกษานักบัญชีก่อนยื่นจริง
 */

import { useState, useMemo } from "react"
import { Download, AlertCircle, FileText, TrendingDown, Calculator, Info } from "lucide-react"
import { formatThb } from "@/lib/utils"

// ── Thai personal income tax brackets 2566 (2023) ─────────────────────────────
const TAX_BRACKETS = [
  { min: 0,        max: 150_000,   rate: 0   },
  { min: 150_000,  max: 300_000,   rate: 0.05 },
  { min: 300_000,  max: 500_000,   rate: 0.10 },
  { min: 500_000,  max: 750_000,   rate: 0.15 },
  { min: 750_000,  max: 1_000_000, rate: 0.20 },
  { min: 1_000_000,max: 2_000_000, rate: 0.25 },
  { min: 2_000_000,max: 5_000_000, rate: 0.30 },
  { min: 5_000_000,max: Infinity,  rate: 0.35 },
]

// ── Standard deductions (ค่าใช้จ่ายเหมา) ─────────────────────────────────────
const STANDARD_EXPENSE_RATE = 0.50   // 50% ไม่เกิน 100,000 บาท
const STANDARD_EXPENSE_MAX  = 100_000

// ── Categories that count as personal expense deductions ──────────────────────
const DEDUCTIBLE_CATEGORIES = new Set([
  "ค่าเดินทาง", "ค่าการศึกษา", "ค่าประกัน", "ค่ารักษาพยาบาล",
  "ค่าสาธารณูปโภค", "ค่าอุปกรณ์สำนักงาน", "ค่าซอฟต์แวร์",
  "transportation", "education", "insurance", "medical", "utilities", "equipment", "software",
])

type Doc = {
  id: string; vendor_name: string | null; total_amount: number | null
  vat_amount: number | null; doc_date: string | null
  category: string | null; status: string
}

function calcTax(netIncome: number): number {
  let tax = 0
  for (const b of TAX_BRACKETS) {
    if (netIncome <= b.min) break
    const taxable = Math.min(netIncome, b.max) - b.min
    tax += taxable * b.rate
  }
  return Math.round(tax)
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; tone: "brand" | "emerald" | "amber" | "red"
}) {
  const tones = {
    brand:   "bg-brand-500/10 text-brand-600 dark:text-brand-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    red:     "bg-red-500/10 text-red-600 dark:text-red-300",
  }
  return (
    <div className="bg-card border border-border rounded-[12px] p-5">
      <div className={`inline-flex h-9 w-9 rounded-[8px] items-center justify-center ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="mt-1 text-[22px] font-bold text-foreground tabular-nums">{value}</div>
      {sub && <div className="text-[12px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function PersonalTaxClient({ userId, year, docs }: {
  userId: string; year: number; docs: Doc[]
}) {
  const [income,    setIncome]    = useState("")
  const [useStdExp, setUseStdExp] = useState(true)   // ใช้ค่าใช้จ่ายเหมา หรือค่าจริง

  // Total spending from receipts this year
  const totalSpend = useMemo(() =>
    docs.reduce((s, d) => s + (d.total_amount ?? 0), 0), [docs])

  // VAT input (ภาษีซื้อ ไม่นับในค่าใช้จ่ายที่ลดหย่อน)
  const totalVat = useMemo(() =>
    docs.reduce((s, d) => s + (d.vat_amount ?? 0), 0), [docs])

  // Deductible expenses from documents
  const deductibleFromDocs = useMemo(() =>
    docs
      .filter(d => d.category && DEDUCTIBLE_CATEGORIES.has(d.category))
      .reduce((s, d) => s + ((d.total_amount ?? 0) - (d.vat_amount ?? 0)), 0),
  [docs])

  // Tax calculation
  const grossIncome   = Number(income.replace(/,/g, "")) || 0
  const stdExpense    = Math.min(grossIncome * STANDARD_EXPENSE_RATE, STANDARD_EXPENSE_MAX)
  const actualExpense = deductibleFromDocs
  const chosenExpense = useStdExp ? stdExpense : actualExpense

  // Personal deductions (standard ones)
  const personalDeduction = 60_000  // ค่าลดหย่อนส่วนตัว
  const spouseDeduction   = 0       // ค่าลดหย่อนคู่สมรส (ปรับได้)

  const netIncome    = Math.max(0, grossIncome - chosenExpense - personalDeduction - spouseDeduction)
  const estimatedTax = calcTax(netIncome)

  // Grouped by category for the deduction breakdown
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of docs) {
      const cat = d.category || "อื่นๆ"
      map.set(cat, (map.get(cat) ?? 0) + (d.total_amount ?? 0))
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [docs])

  const exportSummary = () => {
    const rows = [
      ["ประเภท", "จำนวน (บาท)"],
      ["รายได้รวม", grossIncome.toFixed(2)],
      ["ค่าใช้จ่าย (หัก)", chosenExpense.toFixed(2)],
      ["ค่าลดหย่อนส่วนตัว", personalDeduction.toFixed(2)],
      ["รายได้สุทธิ", netIncome.toFixed(2)],
      ["ประมาณภาษีที่ต้องชำระ", estimatedTax.toFixed(2)],
      [],
      ["รายจ่ายที่บันทึกปี " + year, ""],
      ...byCategory.map(([cat, amt]) => [cat, amt.toFixed(2)]),
      ["รวม", totalSpend.toFixed(2)],
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement("a"), { href: url, download: `personal-tax-${year}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-foreground">ภาษีส่วนบุคคล (ภ.ง.ด.90/91)</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            ประมาณภาษีเงินได้บุคคลธรรมดา ปี {year} · ข้อมูลจาก {docs.length} เอกสาร
          </p>
        </div>
        <button
          onClick={exportSummary}
          className="h-9 px-4 rounded-[10px] border border-border bg-card text-sm font-medium
            text-foreground hover:bg-muted transition inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-500/8
        border border-amber-200 dark:border-amber-500/20 rounded-[10px]">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-amber-700 dark:text-amber-300 leading-relaxed">
          ตัวเลขนี้เป็นการ<strong>ประมาณการ</strong>เท่านั้น อัตราภาษีอ้างอิงปี 2566
          ควรปรึกษานักบัญชีหรือสรรพากรก่อนยื่นแบบภาษีจริง
        </p>
      </div>

      {/* Two columns: Calculator + Summary */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── Tax Calculator ── */}
        <div className="bg-card border border-border rounded-[14px] p-6 space-y-5">
          <h3 className="font-semibold text-[15px] flex items-center gap-2">
            <Calculator className="w-4 h-4 text-brand-500" />
            คำนวณภาษีประมาณการ
          </h3>

          {/* Gross income input */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              รายได้รวมทั้งปี {year} (บาท)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
              <input
                type="text"
                value={income}
                onChange={e => setIncome(e.target.value.replace(/[^\d,]/g, ""))}
                placeholder="0"
                className="w-full h-11 pl-7 pr-3 rounded-[10px] border border-border bg-background
                  text-sm text-foreground placeholder:text-muted-foreground outline-none
                  focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition tabular-nums"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">รายได้เงินเดือน + ฟรีแลนซ์ + อื่นๆ ทุกประเภท</p>
          </div>

          {/* Expense method toggle */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-muted-foreground">วิธีหักค่าใช้จ่าย</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setUseStdExp(true)}
                className={`p-3 rounded-[10px] border text-left transition ${
                  useStdExp
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div className="text-[12.5px] font-semibold text-foreground">เหมา 50%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {formatThb(stdExpense)} (ไม่เกิน ฿100,000)
                </div>
              </button>
              <button
                onClick={() => setUseStdExp(false)}
                className={`p-3 rounded-[10px] border text-left transition ${
                  !useStdExp
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div className="text-[12.5px] font-semibold text-foreground">ค่าใช้จ่ายจริง</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {formatThb(deductibleFromDocs)} (จากเอกสาร)
                </div>
              </button>
            </div>
          </div>

          {/* Calculation breakdown */}
          {grossIncome > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              {[
                { label: "รายได้รวม",          value: grossIncome,        sign: "" },
                { label: "หักค่าใช้จ่าย",       value: chosenExpense,       sign: "-" },
                { label: "หักค่าลดหย่อนส่วนตัว",value: personalDeduction,   sign: "-" },
                { label: "รายได้สุทธิ",         value: netIncome,           sign: "=" },
              ].map(({ label, value, sign }) => (
                <div key={label} className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">{sign && <span className="font-mono mr-1 text-muted-foreground/60">{sign}</span>}{label}</span>
                  <span className={`font-semibold tabular-nums ${sign === "=" ? "text-foreground text-[15px]" : "text-foreground"}`}>
                    {formatThb(value)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-[13px] font-semibold">ภาษีที่ต้องชำระ (ประมาณ)</span>
                <span className="text-[18px] font-bold text-red-600 dark:text-red-400 tabular-nums">
                  {formatThb(estimatedTax)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                อัตราภาษีขั้นบันไดสูงสุด {grossIncome > 5_000_000 ? "35%" : grossIncome > 2_000_000 ? "30%" : grossIncome > 1_000_000 ? "25%" : grossIncome > 750_000 ? "20%" : "15%"}
              </p>
            </div>
          )}
        </div>

        {/* ── Spending Summary from documents ── */}
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="รายจ่ายรวมปีนี้"
              value={formatThb(totalSpend)}
              sub={`${docs.length} เอกสาร`}
              icon={FileText}
              tone="brand"
            />
            <StatCard
              label="VAT ซื้อ"
              value={formatThb(totalVat)}
              sub="ภาษีมูลค่าเพิ่ม"
              icon={TrendingDown}
              tone="emerald"
            />
          </div>

          {/* Expense by category */}
          <div className="bg-card border border-border rounded-[14px] p-5">
            <h3 className="font-semibold text-[14px] mb-4">รายจ่ายแยกตามหมวด</h3>
            {byCategory.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-6">ยังไม่มีข้อมูลรายจ่ายปีนี้</p>
            ) : (
              <div className="space-y-3">
                {byCategory.slice(0, 8).map(([cat, amt]) => {
                  const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0
                  const isDeductible = DEDUCTIBLE_CATEGORIES.has(cat)
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-medium text-foreground">{cat}</span>
                          {isDeductible && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400
                              bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                              ลดหย่อนได้
                            </span>
                          )}
                        </div>
                        <span className="text-[12.5px] font-semibold text-foreground tabular-nums">
                          {formatThb(amt)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tax brackets reference */}
          <div className="bg-card border border-border rounded-[14px] p-5">
            <h3 className="font-semibold text-[14px] mb-3">อัตราภาษีเงินได้บุคคลธรรมดา 2566</h3>
            <div className="space-y-1.5">
              {TAX_BRACKETS.filter(b => b.max !== Infinity).map(b => (
                <div key={b.min} className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">
                    {formatThb(b.min)} – {formatThb(b.max)}
                  </span>
                  <span className={`font-semibold ${b.rate === 0 ? "text-emerald-600" : "text-foreground"}`}>
                    {(b.rate * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-[12px] border-t border-border pt-1.5 mt-1.5">
                <span className="text-muted-foreground">5,000,000 ขึ้นไป</span>
                <span className="font-semibold text-foreground">35%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
