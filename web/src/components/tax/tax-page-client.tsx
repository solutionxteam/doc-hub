"use client"

import { useState }    from "react"
import { Download, Plus, ArrowUpRight, Send, CheckCircle, FileText } from "lucide-react"
import { formatThb, formatDate } from "@/lib/utils"

const VAT_ROWS = [
  { m: "ม.ค.",  input: 7950, output: 6240 },
  { m: "ก.พ.",  input: 7179, output: 5980 },
  { m: "มี.ค.", input: 8324, output: 7100 },
  { m: "เม.ย.", input: 9314, output: 8240 },
  { m: "พ.ค.",  input: 9307, output: 8950, current: true },
]

const WHT_ROWS = [
  { date: "2026-05-08", payer: "บจก. ลูกค้าใหญ่",  amount: 50000, rate: 3, tax: 1500 },
  { date: "2026-05-14", payer: "Acme Tech (TH)",    amount: 80000, rate: 3, tax: 2400 },
  { date: "2026-04-22", payer: "XYZ Holding",        amount: 35000, rate: 5, tax: 1750 },
]

function TaxStat({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub: string
  icon: React.ElementType; tone: "brand" | "purple" | "emerald" | "amber"
}) {
  const tones = {
    brand:   "bg-brand-500/10 text-brand-600 dark:text-brand-300",
    purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  }
  return (
    <div className="bg-card border border-border rounded-[12px] p-5">
      <div className={`inline-flex h-9 w-9 rounded-[8px] items-center justify-center ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="mt-1 text-[22px] font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[12px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}

export function TaxPageClient({ orgId: _orgId }: { orgId: string }) {
  const [period, setPeriod] = useState("2026-05")

  const totalInput  = VAT_ROWS.reduce((s, r) => s + r.input, 0)
  const totalOutput = VAT_ROWS.reduce((s, r) => s + r.output, 0)
  const net         = totalInput - totalOutput

  return (
    <div className="p-6 lg:p-7 space-y-5 max-w-[1600px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold text-foreground">ภาษี (VAT & WHT)</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">สรุปภาษีซื้อ ภาษีขาย และภาษีหัก ณ ที่จ่าย</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3 outline-none focus:border-brand-500 transition"
          />
          <button className="h-10 px-4 rounded-[10px] border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> Export PP.30
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TaxStat label="VAT ซื้อ (Input)"  value={formatThb(9307)} sub="เดือนนี้"   icon={ArrowUpRight} tone="brand" />
        <TaxStat label="VAT ขาย (Output)" value={formatThb(8950)} sub="เดือนนี้"   icon={Send}          tone="purple" />
        <TaxStat label="VAT คงเหลือ"      value={formatThb(357)}  sub="ขอคืน"      icon={CheckCircle}   tone="emerald" />
        <TaxStat label="WHT ที่ถูกหัก"    value={formatThb(5650)} sub="3 ใบที่ผ่านมา" icon={FileText}    tone="amber" />
      </div>

      {/* Monthly VAT table */}
      <div className="bg-card border border-border rounded-[12px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">ภาษีมูลค่าเพิ่ม (VAT) รายเดือน</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">แบบนำส่ง ภพ.30</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> 2026
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">เดือน</th>
                <th className="text-right px-3 py-2.5 font-medium">VAT ซื้อ</th>
                <th className="text-right px-3 py-2.5 font-medium">VAT ขาย</th>
                <th className="text-right px-3 py-2.5 font-medium">สุทธิ</th>
                <th className="text-left px-3 py-2.5 font-medium">สถานะ</th>
                <th className="text-right pr-5 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {VAT_ROWS.map(r => {
                const diff = r.input - r.output
                return (
                  <tr key={r.m} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium text-foreground">{r.m} 2026</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(r.input)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(r.output)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums font-semibold ${diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {diff > 0 ? "+" : ""}{formatThb(diff)}
                    </td>
                    <td className="px-3 py-3">
                      {r.current
                        ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />รอนำส่ง</span>
                        : <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />นำส่งแล้ว</span>
                      }
                    </td>
                    <td className="px-3 py-3 pr-5 text-right">
                      <button className="text-[12px] font-medium text-brand-600 dark:text-brand-400 hover:underline">ดูรายการ</button>
                    </td>
                  </tr>
                )
              })}
              {/* Total row */}
              <tr className="bg-muted/40 font-semibold">
                <td className="px-5 py-3 text-foreground">รวม</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(totalInput)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(totalOutput)}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${net > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {net > 0 ? "+" : ""}{formatThb(net)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* WHT table */}
      <div className="bg-card border border-border rounded-[12px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">ภาษีหัก ณ ที่จ่าย (WHT)</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">ที่ถูกหักจากผู้จ่ายเงิน</p>
          </div>
          <button className="h-8 px-3 rounded-[8px] border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> เพิ่มรายการ
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">วันที่</th>
                <th className="text-left px-3 py-2.5 font-medium">ผู้จ่ายเงิน</th>
                <th className="text-right px-3 py-2.5 font-medium">ยอดเงิน</th>
                <th className="text-right px-3 py-2.5 font-medium">อัตรา</th>
                <th className="text-right pr-5 py-2.5 font-medium">ภาษีที่ถูกหัก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {WHT_ROWS.map((r, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                  <td className="px-3 py-3 font-medium text-foreground">{r.payer}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatThb(r.amount)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.rate}%</td>
                  <td className="pr-5 py-3 text-right tabular-nums font-semibold text-foreground">{formatThb(r.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
