"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState, useEffect, useCallback } from "react"
import { Download, Plus, ArrowUpRight, Send, CheckCircle, FileText } from "lucide-react"
import { formatThb, formatDate } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────
type VatMonth = {
  year:     number
  month:    number
  input:    { vat: number; base: number }
  output:   { vat: number; base: number }
  net_vat:  number
  due_date: string | null
}

type WhtItem = {
  date:   string
  payer:  string
  amount: number
  rate:   number
  tax:    number
}

type WhtData = {
  items:      WhtItem[]
  total_base: number
  total_wht:  number
}

// ── Thai month names ───────────────────────────────────────────────────────────
const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]

// ── Helper ─────────────────────────────────────────────────────────────────────
function nowPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function TaxStat({ label, value, sub, icon: Icon, tone, loading }: {
  label: string; value: string; sub: string
  icon: React.ElementType; tone: "brand" | "purple" | "emerald" | "amber"
  loading?: boolean
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
      {loading ? (
        <div className="mt-1.5 h-7 w-28 rounded-[6px] bg-muted animate-pulse" />
      ) : (
        <div className="mt-1 text-[22px] font-bold text-foreground tabular-nums">{value}</div>
      )}
      <div className="text-[12px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className={`px-3 py-3 ${i === 0 ? "pl-5" : ""} ${i === cols - 1 ? "pr-5" : ""}`}>
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={99} className="px-5 py-12 text-center text-[13px] text-muted-foreground">
        {text}
      </td>
    </tr>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function TaxPageClient({ orgId }: { orgId: string }) {
  const [period, setPeriod]       = useState(nowPeriod)
  const [vatHistory, setVatHistory] = useState<VatMonth[]>([])
  const [currentVat, setCurrentVat] = useState<VatMonth | null>(null)
  const [whtData, setWhtData]     = useState<WhtData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [whtLoading, setWhtLoading] = useState(true)

  // Parse period
  const [year, month] = period.split("-").map(Number)

  const fetchAll = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setWhtLoading(true)

    // Fetch current month VAT + WHT + last 5 months history in parallel
    const [vatRes, whtRes, historyRes] = await Promise.all([
      fetch(`/api/tax/vat?orgId=${orgId}&year=${y}&month=${m}`)
        .then(r => r.json()).catch(() => null),
      fetch(`/api/tax/wht?orgId=${orgId}&year=${y}&month=${m}`)
        .then(r => r.json()).catch(() => null),
      fetch(`/api/tax/vat?orgId=${orgId}&year=${y}&month=${m}&history=5`)
        .then(r => r.json()).catch(() => []),
    ])

    setCurrentVat(vatRes)
    setWhtData(whtRes)
    setVatHistory(Array.isArray(historyRes) ? historyRes : [])
    setLoading(false)
    setWhtLoading(false)
  }, [orgId])

  useEffect(() => {
    fetchAll(year, month)
  }, [year, month, fetchAll])

  // Derived KPI values
  const inputVat  = currentVat?.input.vat   ?? 0
  const outputVat = currentVat?.output.vat  ?? 0
  const netVat    = currentVat?.net_vat     ?? 0
  const totalWht  = whtData?.total_wht      ?? 0
  const whtCount  = whtData?.items.length   ?? 0

  const totalInputAll  = vatHistory.reduce((s, r) => s + (r.input.vat ?? 0), 0)
  const totalOutputAll = vatHistory.reduce((s, r) => s + (r.output.vat ?? 0), 0)
  const totalNetAll    = vatHistory.reduce((s, r) => s + (r.net_vat ?? 0), 0)

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
        <TaxStat
          label="VAT ซื้อ (Input)"
          value={formatThb(inputVat)}
          sub="เดือนนี้"
          icon={ArrowUpRight}
          tone="brand"
          loading={loading}
        />
        <TaxStat
          label="VAT ขาย (Output)"
          value={formatThb(outputVat)}
          sub="เดือนนี้"
          icon={Send}
          tone="purple"
          loading={loading}
        />
        <TaxStat
          label={netVat >= 0 ? "VAT ที่ต้องชำระ" : "VAT คงเหลือ (ขอคืน)"}
          value={formatThb(Math.abs(netVat))}
          sub={currentVat?.due_date ? `ครบกำหนด ${formatDate(currentVat.due_date)}` : "เดือนนี้"}
          icon={CheckCircle}
          tone="emerald"
          loading={loading}
        />
        <TaxStat
          label="WHT ที่ถูกหัก"
          value={formatThb(totalWht)}
          sub={whtCount > 0 ? `${whtCount} รายการ` : "เดือนนี้"}
          icon={FileText}
          tone="amber"
          loading={whtLoading}
        />
      </div>

      {/* Monthly VAT table */}
      <div className="bg-card border border-border rounded-[12px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">ภาษีมูลค่าเพิ่ม (VAT) รายเดือน</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">แบบนำส่ง ภพ.30 — 5 เดือนล่าสุด</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {year}
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
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              ) : vatHistory.length === 0 ? (
                <EmptyState text="ไม่พบข้อมูล VAT — เริ่มสแกนเอกสารเพื่อดึงข้อมูลภาษีอัตโนมัติ" />
              ) : (
                <>
                  {vatHistory.map(r => {
                    const isCurrent = r.year === year && r.month === month
                    const net = r.net_vat
                    const hasData = r.input.vat > 0 || r.output.vat > 0
                    return (
                      <tr key={`${r.year}-${r.month}`} className={`hover:bg-muted/30 ${isCurrent ? "bg-brand-50/50 dark:bg-brand-500/5" : ""}`}>
                        <td className="px-5 py-3 font-medium text-foreground">
                          {THAI_MONTHS[r.month - 1]} {r.year}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-500/20 px-1.5 py-0.5 rounded-full">เดือนนี้</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(r.input.vat)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(r.output.vat)}</td>
                        <td className={`px-3 py-3 text-right tabular-nums font-semibold ${net < 0 ? "text-emerald-600 dark:text-emerald-400" : net > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                          {net !== 0 ? (net < 0 ? "-" : "+") : ""}{formatThb(Math.abs(net))}
                        </td>
                        <td className="px-3 py-3">
                          {!hasData ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />ไม่มีข้อมูล
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />รอนำส่ง
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />นำส่งแล้ว
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 pr-5 text-right">
                          {hasData && (
                            <button className="text-[12px] font-medium text-brand-600 dark:text-brand-400 hover:underline">ดูรายการ</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Total row */}
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-5 py-3 text-foreground">รวม</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(totalInputAll)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(totalOutputAll)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${totalNetAll < 0 ? "text-emerald-600 dark:text-emerald-400" : totalNetAll > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                      {totalNetAll !== 0 ? (totalNetAll < 0 ? "-" : "+") : ""}{formatThb(Math.abs(totalNetAll))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WHT table */}
      <div className="bg-card border border-border rounded-[12px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">ภาษีหัก ณ ที่จ่าย (WHT)</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">ที่ถูกหักจากผู้จ่ายเงิน — {THAI_MONTHS[month - 1]} {year}</p>
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
              {whtLoading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
              ) : !whtData?.items.length ? (
                <EmptyState text="ไม่พบรายการ WHT ในเดือนนี้" />
              ) : (
                <>
                  {whtData.items.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                      <td className="px-3 py-3 font-medium text-foreground">{r.payer}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatThb(r.amount)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.rate}%</td>
                      <td className="pr-5 py-3 text-right tabular-nums font-semibold text-foreground">{formatThb(r.tax)}</td>
                    </tr>
                  ))}
                  {/* Summary row */}
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-5 py-3 text-foreground">รวม</td>
                    <td className="px-3 py-3 text-muted-foreground">{whtData.items.length} รายการ</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatThb(whtData.total_base)}</td>
                    <td className="px-3 py-3"></td>
                    <td className="pr-5 py-3 text-right tabular-nums text-foreground">{formatThb(whtData.total_wht)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
