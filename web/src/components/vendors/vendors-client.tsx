"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เ��็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

import { useState, useMemo, useEffect } from "react"
import dynamic from "next/dynamic"
import {
  Search, Download, MapPin, BarChart3, FileText, Clock,
  TrendingUp, Building2, Map, List, BadgeCheck,
} from "lucide-react"
import { formatThb, formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Vendor {
  id:              string
  name:            string
  tax_id:          string | null
  address:         string | null
  phone:           string | null
  category:        string | null
  lat:             number | null
  lng:             number | null
  doc_count:       number
  total_amount:    number
  vat_total:       number
  last_doc_date:   string | null
}

interface Props { vendors: Vendor[] }

// ── Lazy-load map (client-only — Leaflet requires window) ─────────────────────
const VendorMap = dynamic(() => import("./vendor-map"), { ssr: false, loading: () => (
  <div className="flex-1 flex items-center justify-center bg-muted/20 rounded-[12px]">
    <div className="text-sm text-muted-foreground">กำลังโหลดแผนที่...</div>
  </div>
)})

// ── Helpers ────��──────────────────────────────────────────────────────────────
const THUMB_MAP: [string, string][] = [
  ["grab",       "🚖"], ["line man",  "🛵"], ["lineman",   "🛵"],
  ["foodpanda",  "🛵"], ["robinhood", "🛵"], ["shopee",    "🛍️"],
  ["lazada",     "🛍️"], ["amazon",    "☁️"], ["aws",       "☁️"],
  ["google",     "☁️"], ["microsoft", "☁️"], ["azure",     "☁️"],
  ["7-eleven",   "🧾"], ["7eleven",   "🧾"], ["makro",     "🛒"],
  ["lotus",      "🛒"], ["big c",     "🛒"], ["homepro",   "🔨"],
  ["shell",      "⛽"], ["ptt",       "⛽"], ["bangchak",  "⛽"],
  ["esso",       "⛽"], ["caltex",    "⛽"], ["ais",       "📶"],
  ["true",       "📶"], ["dtac",      "📶"], ["mea",       "💡"],
  ["pea",        "💡"], ["mwa",       "💧"], ["starbucks", "☕"],
  ["figma",      "🎨"], ["slack",     "🎨"], ["notion",    "🎨"],
]
function getThumb(name: string) {
  const l = name.toLowerCase()
  for (const [k, e] of THUMB_MAP) if (l.includes(k)) return e
  return "🏢"
}

// Deterministic brand color from name
function brandColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  const colors = [
    "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
    "#06b6d4","#f97316","#ec4899","#84cc16","#6366f1",
  ]
  return colors[Math.abs(h) % colors.length]
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; tone: "brand" | "emerald" | "purple" | "amber"
}) {
  const cls = {
    brand:   "bg-brand-500/10 text-brand-600 dark:text-brand-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-300",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  }[tone]
  return (
    <div className="bg-card border border-border rounded-[12px] p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0", cls)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-[18px] font-bold text-foreground tabular-nums truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ── Vendor card ───���───────────────────────────────────────────────────────────
function VendorCard({ v }: { v: Vendor }) {
  const color = brandColor(v.name)
  const thumb = getThumb(v.name)
  const initial = v.name[0]?.toUpperCase() ?? "?"

  return (
    <div className="bg-card border border-border rounded-[12px] p-5
      hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600
      transition-all duration-150 cursor-pointer group">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-[12px] flex items-center justify-center
          font-bold text-white text-[18px] shrink-0 select-none"
          style={{ background: color }}>
          {thumb === "🏢" ? initial : thumb}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate text-[14px]
            group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
            {v.name}
          </p>
          {v.tax_id ? (
            <p className="text-[11.5px] text-muted-foreground truncate flex items-center gap-1">
              <BadgeCheck className="w-3 h-3 shrink-0 text-emerald-500" />
              Tax ID {v.tax_id}
            </p>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">ไม่มีเลขผู้เสียภาษี</p>
          )}
        </div>
      </div>

      {/* Category */}
      {v.category && (
        <div className="mt-2.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium
            bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {v.category}
          </span>
        </div>
      )}

      {/* Address */}
      {v.address && (
        <p className="mt-2.5 text-[11.5px] text-muted-foreground line-clamp-2 flex items-start gap-1">
          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
          {v.address}
        </p>
      )}

      {/* Amounts */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">ยอดรวมทั้งสิ้น</p>
          <p className="text-[20px] font-bold text-foreground tabular-nums">
            {formatThb(v.total_amount).replace(".00", "")}
          </p>
          {v.vat_total > 0 && (
            <p className="text-[11px] text-muted-foreground">VAT {formatThb(v.vat_total).replace(".00", "")}</p>
          )}
        </div>
        {/* Geo badge */}
        {v.lat && v.lng && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400
            bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full">
            <MapPin className="w-3 h-3" />
            บนแผนที่
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between
        text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FileText className="w-3 h-3" />
          {v.doc_count} เอกสาร
        </span>
        {v.last_doc_date && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatDate(v.last_doc_date)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Empty state ────��──────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="col-span-full bg-card border border-dashed border-border
      rounded-[12px] py-20 text-center">
      <div className="inline-flex h-16 w-16 rounded-full bg-muted items-center
        justify-center mb-4 mx-auto">
        <Building2 className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">ยังไม่มีข้อมูลผู้ขาย</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
        ข้อมูลผู้ขายจะถูกบันทึกอัตโนมัติเมื่ออนุมัติเอกสาร
      </p>
    </div>
  )
}

// ── Main component ────��───────────────────────────────────────────────────────
export function VendorsClient({ vendors }: Props) {
  const [query,  setQuery]  = useState("")
  const [sort,   setSort]   = useState<"total"|"docs"|"name">("total")
  const [tab,    setTab]    = useState<"list"|"map">("list")

  const filtered = useMemo(() =>
    vendors
      .filter(v => !query ||
        v.name.toLowerCase().includes(query.toLowerCase()) ||
        (v.tax_id ?? "").includes(query) ||
        (v.address ?? "").toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) =>
        sort === "total" ? b.total_amount - a.total_amount :
        sort === "docs"  ? b.doc_count    - a.doc_count    :
        a.name.localeCompare(b.name, "th")
      ),
  [vendors, query, sort])

  const totalSpend = vendors.reduce((s, v) => s + v.total_amount, 0)
  const totalDocs  = vendors.reduce((s, v) => s + v.doc_count, 0)
  const geoCount   = vendors.filter(v => v.lat && v.lng).length

  return (
    <div className="p-6 lg:p-7 space-y-5 max-w-[1500px] animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold text-foreground">ผู้ขาย / Vendors</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            บันทึกจากเอกสารที่อนุมัติแล้ว · ตำแหน่งบนแผนที่จาก OpenStreetMap
          </p>
        </div>
        <button className="h-10 px-4 rounded-[10px] border border-border bg-card
          text-sm font-medium text-foreground hover:bg-muted transition
          inline-flex items-center gap-2">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ผู้ขายทั้งหมด"  value={vendors.length.toString()}              icon={Building2}   tone="brand"   />
        <StatCard label="รวมยอดทั้งสิ้น" value={formatThb(totalSpend).replace(".00","")} icon={TrendingUp}  tone="emerald"
          sub={`${vendors.filter(v => v.vat_total > 0).length} ราย มี VAT`} />
        <StatCard label="จำนวนเอกสาร"   value={totalDocs.toLocaleString()}              icon={FileText}    tone="purple"  />
        <StatCard label="บนแผนที่"       value={geoCount.toString()}                     icon={MapPin}      tone="amber"
          sub={vendors.length ? `${Math.round(geoCount/vendors.length*100)}% ระบุตำแหน่งได้` : ""} />
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-[12px] p-3
        flex flex-wrap items-center gap-2.5">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
            text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อผู้ขาย เลข Tax ID หรือที่อยู่"
            className="w-full h-10 rounded-[10px] border border-border bg-card text-sm
              text-foreground pl-10 pr-3 outline-none focus:border-brand-500
              focus:ring-2 focus:ring-brand-500/15 placeholder:text-muted-foreground/60 transition"
          />
        </div>

        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
          className="h-10 rounded-[10px] border border-border bg-card text-sm
            text-foreground px-3 outline-none focus:border-brand-500 transition">
          <option value="total">เรียง: ยอดรวม</option>
          <option value="docs">เรียง: จำนวนเอกสาร</option>
          <option value="name">เรียง: ชื่อ A–Z</option>
        </select>

        {/* Tab toggle */}
        <div className="flex items-center bg-muted rounded-[10px] p-1 gap-1 ml-auto">
          {([["list","รายการ", List], ["map","แผนที่", Map]] as const).map(([key, label, Icon]) => (
            <button key={key} type="button"
              onClick={() => setTab(key)}
              className={cn(
                "h-8 px-3 rounded-[8px] text-sm font-medium inline-flex items-center gap-1.5 transition",
                tab === key
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "list" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length > 0
            ? filtered.map(v => <VendorCard key={v.id} v={v} />)
            : <EmptyState />
          }
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden border border-border" style={{ height: 580 }}>
          <VendorMap vendors={filtered} />
        </div>
      )}

      {/* Top 5 by spend — below the list */}
      {tab === "list" && filtered.length > 0 && (
        <div className="bg-card border border-border rounded-[12px] overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-500" />
            <span className="text-[13px] font-semibold text-foreground">
              Top {Math.min(5, filtered.length)} ผู้ขาย (ยอดใช้จ่ายสูงสุด)
            </span>
          </div>
          <div className="p-5 space-y-3">
            {filtered.slice(0, 5).map((v, i) => {
              const pct = filtered[0].total_amount > 0
                ? Math.round((v.total_amount / filtered[0].total_amount) * 100)
                : 0
              return (
                <div key={v.id} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="h-8 w-8 rounded-[8px] flex items-center justify-center
                    text-sm font-bold text-white shrink-0"
                    style={{ background: brandColor(v.name) }}>
                    {getThumb(v.name) === "🏢" ? v.name[0]?.toUpperCase() : getThumb(v.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-medium truncate">{v.name}</span>
                      <span className="text-[13px] font-bold tabular-nums text-foreground ml-2 shrink-0">
                        {formatThb(v.total_amount).replace(".00", "")}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
