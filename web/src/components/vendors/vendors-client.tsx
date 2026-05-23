"use client"

import { useState, useMemo } from "react"
import { Search, Download, Plus, TrendingUp, TrendingDown, MoreHorizontal, FileText, Clock } from "lucide-react"
import { formatThb, formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

const VENDOR_DATA = [
  { id:"v1",  name:"Amazon Web Services",          initial:"A",  color:"#FF9900", category:"ค่า Software / Cloud",  taxId:"0993000159421", docs:8,  total:38200,  vat:2499, last:"2026-05-16", trend:+22 },
  { id:"v2",  name:"บจก. โอเอ็ม พร็อพเพอร์ตี้",  initial:"O",  color:"#0ea5e9", category:"ค่าเช่าสำนักงาน",       taxId:"0105557123456", docs:5,  total:175000, vat:11449,last:"2026-05-14", trend:0  },
  { id:"v3",  name:"Grab (Thailand)",              initial:"G",  color:"#00B14F", category:"ค่าเดินทาง",             taxId:"0105557654321", docs:23, total:12450,  vat:815,  last:"2026-05-17", trend:+8 },
  { id:"v4",  name:"7-Eleven",                     initial:"7",  color:"#EF4135", category:"ของใช้สำนักงาน",         taxId:"0107537000033", docs:41, total:9870,   vat:646,  last:"2026-05-17", trend:-3 },
  { id:"v5",  name:"Starbucks Coffee",             initial:"S",  color:"#0F6549", category:"รับรองลูกค้า",           taxId:"0105538000034", docs:18, total:3420,   vat:224,  last:"2026-05-15", trend:+15},
  { id:"v6",  name:"Figma Inc.",                   initial:"F",  color:"#0ACF83", category:"ค่า Software / Cloud",  taxId:"-",             docs:3,  total:7050,   vat:461,  last:"2026-05-14", trend:+5 },
  { id:"v7",  name:"TrueMove H",                   initial:"T",  color:"#E2231A", category:"ค่าโทรศัพท์",            taxId:"0107550000074", docs:6,  total:7194,   vat:470,  last:"2026-05-12", trend:0  },
  { id:"v8",  name:"การไฟฟ้านครหลวง",              initial:"ฟ",  color:"#005baa", category:"ค่าสาธารณูปโภค",         taxId:"0994000165179", docs:5,  total:6150,   vat:402,  last:"2026-05-16", trend:+12},
  { id:"v9",  name:"AIS Fibre",                    initial:"A",  color:"#7CC242", category:"ค่าอินเทอร์เน็ต",        taxId:"0107535000164", docs:5,  total:2995,   vat:196,  last:"2026-05-15", trend:0  },
  { id:"v10", name:"PTT Station ทองหล่อ",          initial:"P",  color:"#0E70BB", category:"ค่าน้ำมัน",              taxId:"0107544000094", docs:9,  total:13500,  vat:883,  last:"2026-05-11", trend:+30},
  { id:"v11", name:"Lazada Express",               initial:"L",  color:"#0F146D", category:"ของใช้สำนักงาน",         taxId:"0105556789012", docs:14, total:11200,  vat:733,  last:"2026-05-13", trend:+18},
  { id:"v12", name:"การประปานครหลวง",              initial:"ป",  color:"#009CDC", category:"ค่าสาธารณูปโภค",         taxId:"0107533000046", docs:4,  total:1248,   vat:82,   last:"2026-05-10", trend:+2 },
]

/** Deterministic sparkline points from vendor ID */
function sparkPoints(id: string, w = 90, h = 26): { path: string; area: string } {
  let seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const vals = Array.from({ length: 12 }).map(() => {
    seed = (seed * 9301 + 49297) % 233280
    return (seed / 233280) * 0.7 + 0.3
  })
  const max = Math.max(...vals), min = Math.min(...vals)
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * h
    return [x.toFixed(1), y.toFixed(1)] as [string, string]
  })
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ")
  const area = `M 0,${h} L ${path.slice(1)} L ${w},${h} Z`
  return { path, area }
}

function VendorCard({ v, maxTotal: _maxTotal }: { v: typeof VENDOR_DATA[0]; maxTotal: number }) {
  const trendPos = v.trend >= 0
  const { path, area } = sparkPoints(v.id)
  const strokeColor = trendPos ? "#10b981" : "#ef4444"

  return (
    <div className="bg-card border border-border rounded-[12px] p-5 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600 transition cursor-pointer group">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-[12px] flex items-center justify-center font-bold text-white text-[18px] shrink-0"
          style={{ background: v.color }}>
          {v.initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition text-[14px]">
            {v.name}
          </div>
          <div className="text-[11.5px] text-muted-foreground truncate">
            {v.taxId !== "-" ? `Tax ID ${v.taxId}` : "ไม่มีเลขผู้เสียภาษี"}
          </div>
        </div>
        <button className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          {v.category}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">ยอดรวมตลอด</div>
          <div className="text-[20px] font-bold text-foreground tabular-nums">{formatThb(v.total).replace(".00","")}</div>
          <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">VAT {formatThb(v.vat).replace(".00","")}</div>
        </div>
        <div className="text-right">
          <svg viewBox={`0 0 90 26`} width={90} height={26} className="opacity-90">
            <defs>
              <linearGradient id={`sg-${v.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#sg-${v.id})`} />
            <path d={path} stroke={strokeColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className={cn("text-[11px] font-medium mt-0.5 inline-flex items-center gap-0.5",
            trendPos ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {v.trend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : v.trend < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : null}
            {v.trend > 0 ? "+" : ""}{v.trend}%
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> {v.docs} เอกสาร
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> {formatDate(v.last)}
        </span>
      </div>
    </div>
  )
}

function VendorStat({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: React.ElementType
  tone: "brand" | "emerald" | "purple" | "amber"
}) {
  const tones = {
    brand:   "bg-brand-500/10 text-brand-600 dark:text-brand-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-300",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  }
  return (
    <div className="bg-card border border-border rounded-[12px] p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-[10px] flex items-center justify-center", tones[tone])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-[18px] font-bold text-foreground tabular-nums truncate">{value}</div>
      </div>
    </div>
  )
}

export function VendorsClient() {
  const [query,    setQuery]    = useState("")
  const [category, setCategory] = useState("all")
  const [sort,     setSort]     = useState("total")

  const categories = useMemo(() => Array.from(new Set(VENDOR_DATA.map(v => v.category))), [])

  const filtered = useMemo(() => VENDOR_DATA
    .filter(v => category === "all" || v.category === category)
    .filter(v => !query || v.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "total" ? b.total - a.total : sort === "docs" ? b.docs - a.docs : a.name.localeCompare(b.name)),
  [query, category, sort])

  const totalSpend = VENDOR_DATA.reduce((s, v) => s + v.total, 0)
  const totalDocs  = VENDOR_DATA.reduce((s, v) => s + v.docs, 0)
  const maxTotal   = Math.max(...filtered.map(v => v.total))

  return (
    <div className="p-6 lg:p-7 space-y-5 max-w-[1500px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold text-foreground">ผู้ขาย / Vendors</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">รายชื่อผู้ขายทั้งหมดที่คุณทำธุรกรรมด้วย</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-10 px-4 rounded-[10px] border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="h-10 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> เพิ่มผู้ขาย
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VendorStat label="ผู้ขายทั้งหมด"  value={VENDOR_DATA.length.toString()}    icon={TrendingUp}  tone="brand" />
        <VendorStat label="รวมยอดทั้งสิ้น" value={formatThb(totalSpend).replace(".00","")} icon={TrendingUp} tone="emerald" />
        <VendorStat label="จำนวนเอกสาร"   value={totalDocs.toLocaleString()}        icon={FileText}    tone="purple" />
        <VendorStat label="หมวดหมู่"       value={categories.length.toString()}      icon={TrendingUp}  tone="amber" />
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-[12px] p-3 flex flex-wrap items-center gap-2.5">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อผู้ขาย หรือเลขผู้เสียภาษี"
            className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground pl-10 pr-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 placeholder:text-muted-foreground/60 transition"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3 outline-none focus:border-brand-500 transition"
        >
          <option value="all">ทุกหมวดหมู่</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3 outline-none focus:border-brand-500 transition"
        >
          <option value="total">เรียงตาม: ยอดรวม</option>
          <option value="docs">เรียงตาม: จำนวนเอกสาร</option>
          <option value="name">เรียงตาม: ชื่อ</option>
        </select>
      </div>

      {/* Vendor cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => <VendorCard key={v.id} v={v} maxTotal={maxTotal} />)}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-[12px] p-16 text-center">
          <div className="inline-flex h-16 w-16 rounded-full bg-muted items-center justify-center mb-4">
            <TrendingUp className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">ไม่พบผู้ขาย</h3>
          <p className="text-sm text-muted-foreground mt-1">ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p>
        </div>
      )}
    </div>
  )
}
