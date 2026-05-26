"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { LogoMark } from "@/components/ui/logo"
import { Icons }    from "@/components/ui/icons"
import { cn }       from "@/lib/utils"

// ─── Props & live data types ──────────────────────────────────────────────────

export interface MobileClientProps {
  orgName:         string
  orgPlan:         string
  orgRole:         string
  totalDocs:       number
  pendingDocs:     number
  monthSpend:      number
  prevMonthSpend:  number
  monthlySeries:   { m: string; spend: number }[]
  categories:      { name: string; value: number; color: string }[]
}

type LiveData = MobileClientProps

const LiveDataCtx = createContext<LiveData>({
  orgName: "—", orgPlan: "free", orgRole: "member",
  totalDocs: 0, pendingDocs: 0, monthSpend: 0, prevMonthSpend: 0,
  monthlySeries: [], categories: [],
})
const useLive = () => useContext(LiveDataCtx)

// ─── Demo docs (for interactive phone showcase only) ─────────────────────────

const SAMPLE_DOCS = [
  { id:'d1', vendor:'บมจ. ซีพี ออลล์ (7-Eleven)', vendorEn:'CP All (7-Eleven)', amount:285.00,   vat:18.64,   status:'approved',   date:'2026-05-17T10:24:00', category:'ของใช้สำนักงาน',    invoiceNo:'INV-7E-23984',    confidence:0.97, thumb:'🧾' },
  { id:'d2', vendor:'Grab (Thailand)',              vendorEn:'Grab Thailand',      amount:450.00,   vat:29.44,   status:'reviewing',  date:'2026-05-17T09:12:00', category:'ค่าเดินทาง',        invoiceNo:'GR-2026-005112',  confidence:0.78, thumb:'🚖' },
  { id:'d3', vendor:'Amazon Web Services',          vendorEn:'Amazon Web Services',amount:8750.00,  vat:571.96,  status:'pushed',     date:'2026-05-16T18:30:00', category:'ค่า Software / Cloud',invoiceNo:'AWS-1188372',     confidence:0.99, thumb:'☁️' },
  { id:'d4', vendor:'การไฟฟ้านครหลวง',              vendorEn:'MEA',                amount:1230.00,  vat:80.37,   status:'pending',    date:'2026-05-16T15:05:00', category:'ค่าสาธารณูปโภค',   invoiceNo:'MEA-87234-04',    confidence:0.92, thumb:'💡' },
  { id:'d5', vendor:'AIS Fibre',                    vendorEn:'AIS Fibre',          amount:599.00,   vat:39.15,   status:'failed',     date:'2026-05-15T11:40:00', category:'ค่าอินเทอร์เน็ต',  invoiceNo:'-',               confidence:0.41, thumb:'📶' },
  { id:'d6', vendor:'Starbucks Coffee',             vendorEn:'Starbucks',          amount:185.00,   vat:12.10,   status:'approved',   date:'2026-05-15T09:02:00', category:'รับรองลูกค้า',      invoiceNo:'SB-0515-2244',    confidence:0.95, thumb:'☕' },
  { id:'d7', vendor:'Lazada Express',               vendorEn:'Lazada',             amount:780.00,   vat:51.00,   status:'approved',   date:'2026-05-13T16:22:00', category:'ของใช้สำนักงาน',    invoiceNo:'LZ-2605131234',   confidence:0.93, thumb:'📦' },
  { id:'d8', vendor:'TrueMove H',                   vendorEn:'TrueMove H',         amount:1199.00,  vat:78.36,   status:'approved',   date:'2026-05-12T10:11:00', category:'ค่าโทรศัพท์',       invoiceNo:'TR-2605-008812',  confidence:0.94, thumb:'📱' },
] as const

type Doc = typeof SAMPLE_DOCS[number]

const fmtTHB = (n: number) =>
  '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// Pass `now` explicitly so server and client use the same reference until after mount
function relTime(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime()
  const h = diff / 3.6e6
  if (h < 1)  return `${Math.round(h * 60)} นาทีที่แล้ว`
  if (h < 24) return `${Math.round(h)} ชั่วโมงที่แล้ว`
  return `${Math.round(h / 24)} วันที่แล้ว`
}

// ─── Phone frames ────────────────────────────────────────────────────────────

function PhoneFrameIOS({ children, size = 'lg', shadow = true }: { children: React.ReactNode; size?: 'sm'|'md'|'lg'; shadow?: boolean }) {
  const d = size === 'sm' ? { w:220, h:460, r:36, p:5 } : size === 'md' ? { w:270, h:560, r:40, p:6 } : { w:320, h:670, r:48, p:7 }
  return (
    <div className={cn("relative bg-slate-950 dark:bg-black", shadow && "shadow-2xl shadow-slate-900/30")} style={{ padding: d.p, borderRadius: d.r }}>
      <div className="absolute inset-x-0 top-0 flex justify-center z-30 pointer-events-none">
        <div className="mt-1.5 h-[22px] w-[88px] rounded-full bg-slate-950 dark:bg-black" />
      </div>
      <div className="relative bg-white dark:bg-slate-900 overflow-hidden" style={{ width: d.w, height: d.h, borderRadius: d.r - 6 }}>
        <div className="absolute inset-x-0 top-0 h-10 flex items-center justify-between px-7 text-[11px] font-semibold text-slate-900 dark:text-white z-30 pointer-events-none">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <svg width="14" height="9" viewBox="0 0 14 9" fill="currentColor"><rect x="0" y="4" width="2" height="4" rx="0.5"/><rect x="3.5" y="2.5" width="2" height="5.5" rx="0.5"/><rect x="7" y="1" width="2" height="7" rx="0.5"/><rect x="10.5" y="-0.5" width="2" height="8.5" rx="0.5" opacity="0.4"/></svg>
            <svg width="14" height="9" viewBox="0 0 14 9" fill="currentColor"><path d="M7 1.5a8 8 0 0 1 5.5 2.2l-.7.7A7 7 0 0 0 7 2.5a7 7 0 0 0-4.8 1.9l-.7-.7A8 8 0 0 1 7 1.5zM7 4a5 5 0 0 1 3.5 1.4l-.7.7A4 4 0 0 0 7 5a4 4 0 0 0-2.8 1.1l-.7-.7A5 5 0 0 1 7 4zm0 2.5a2 2 0 0 1 1.4.6L7 8.5 5.6 7.1A2 2 0 0 1 7 6.5z"/></svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor" strokeWidth="0.6"><rect x="0.5" y="1" width="18" height="9" rx="2"/><rect x="2" y="2.5" width="13" height="6" rx="1" fill="currentColor"/><rect x="20" y="3.5" width="1.5" height="4" rx="0.5" fill="currentColor"/></svg>
          </span>
        </div>
        <div className="absolute inset-0 pt-10">{children}</div>
      </div>
    </div>
  )
}

function PhoneFrameAndroid({ children, size = 'lg', shadow = true }: { children: React.ReactNode; size?: 'sm'|'md'|'lg'; shadow?: boolean }) {
  const d = size === 'sm' ? { w:220, h:460, r:24, p:4 } : size === 'md' ? { w:270, h:560, r:28, p:5 } : { w:320, h:670, r:32, p:6 }
  return (
    <div className={cn("relative bg-slate-900 dark:bg-black", shadow && "shadow-2xl shadow-slate-900/30")} style={{ padding: d.p, borderRadius: d.r }}>
      <div className="relative bg-white dark:bg-slate-900 overflow-hidden" style={{ width: d.w, height: d.h, borderRadius: d.r - 4 }}>
        <div className="absolute inset-x-0 top-0 h-7 flex items-center justify-between px-4 text-[10.5px] font-medium text-slate-900 dark:text-white z-30 pointer-events-none">
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="8" viewBox="0 0 12 8" fill="currentColor"><rect x="0" y="3" width="2" height="5" rx="0.5"/><rect x="3" y="2" width="2" height="6" rx="0.5"/><rect x="6" y="1" width="2" height="7" rx="0.5"/><rect x="9" y="0" width="2" height="8" rx="0.5"/></svg>
            <svg width="11" height="8" viewBox="0 0 11 8" fill="currentColor"><path d="M5.5 1a6 6 0 0 1 4.2 1.7l-.7.7A5 5 0 0 0 5.5 2a5 5 0 0 0-3.5 1.4l-.7-.7A6 6 0 0 1 5.5 1zm0 2.5a3 3 0 0 1 2.1.9l-.7.7a2 2 0 0 0-1.4-.6 2 2 0 0 0-1.4.6l-.7-.7a3 3 0 0 1 2.1-.9zm0 2.2a1.3 1.3 0 0 1 .9.4L5.5 7 4.6 6.1a1.3 1.3 0 0 1 .9-.4z"/></svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="currentColor"><rect x="0" y="2" width="18" height="7" rx="1"/><rect x="19" y="3.5" width="2" height="4" rx="0.5"/></svg>
          </span>
        </div>
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-slate-900 dark:bg-black z-30" />
        <div className="absolute inset-0 pt-7">{children}</div>
      </div>
    </div>
  )
}

function PhoneFrame({ platform = 'ios', ...rest }: { platform?: string; children: React.ReactNode; size?: 'sm'|'md'|'lg'; shadow?: boolean }) {
  return platform === 'android' ? <PhoneFrameAndroid {...rest}/> : <PhoneFrameIOS {...rest}/>
}

// ─── Mobile App context ───────────────────────────────────────────────────────

type Screen = { type: string; doc?: Doc }
type MACtx = {
  platform: string
  tab: string; setTab: (t: string) => void
  stack: Screen[]; navigate: (s: Screen) => void; back: () => void; reset: () => void
  current: Screen | undefined
}
const MobileAppCtx = createContext<MACtx>({} as MACtx)
const useMA = () => useContext(MobileAppCtx)

function MobileApp({ platform = 'ios' }: { platform?: string }) {
  const [tab, setTab]     = useState('home')
  const [stack, setStack] = useState<Screen[]>([])
  const navigate  = useCallback((s: Screen)     => setStack(p => [...p, s]), [])
  const back      = useCallback(()              => setStack(p => p.slice(0,-1)), [])
  const reset     = useCallback(()              => setStack([]), [])
  const current   = stack[stack.length - 1]

  return (
    <MobileAppCtx.Provider value={{ platform, tab, setTab, stack, navigate, back, reset, current }}>
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white relative overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          {!current ? (
            tab === 'home'    ? <MHome/> :
            tab === 'docs'    ? <MDocs/> :
            tab === 'stats'   ? <MStats/> :
            tab === 'profile' ? <MProfile/> : null
          ) : (
            <MStackView screen={current}/>
          )}
        </div>
        {!current && <MBottomNav/>}
      </div>
    </MobileAppCtx.Provider>
  )
}

function MStackView({ screen }: { screen: Screen }) {
  switch (screen.type) {
    case 'capture':        return <MCapture/>
    case 'capture-review': return <MCaptureReview/>
    case 'doc-detail':     return <MDocDetail doc={screen.doc!}/>
    case 'notifications':  return <MNotifications/>
    case 'search':         return <MSearch/>
    case 'settings':       return <MSettings/>
    default: return null
  }
}

// ─── App bar ────────────────────────────────────────────────────────────────

function MAppBar({ title, large, right, showBack = true }: { title: string; large?: boolean; right?: React.ReactNode; showBack?: boolean }) {
  const { platform, back } = useMA()
  if (platform === 'ios') return (
    <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
      <div className="h-11 flex items-center justify-between px-2 text-[14px] relative">
        {showBack ? (
          <button onClick={back} className="flex items-center text-brand-500 font-medium pl-1.5"><Icons.ChevronLeft size={20}/></button>
        ) : <span className="w-8"/>}
        {!large && <div className="font-semibold absolute left-1/2 -translate-x-1/2 text-[15px]">{title}</div>}
        <div className="flex items-center gap-1 pr-1.5">{right}</div>
      </div>
      {large && <div className="px-4 pb-2 text-[28px] font-bold tracking-tight">{title}</div>}
    </div>
  )
  return (
    <div className="bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
      <div className="h-14 flex items-center gap-3 px-2">
        {showBack ? (
          <button onClick={back} className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><Icons.ChevronLeft size={20}/></button>
        ) : <span className="w-3"/>}
        <div className="font-semibold text-[17px] flex-1 truncate">{title}</div>
        <div className="flex items-center gap-1 pr-1">{right}</div>
      </div>
    </div>
  )
}

// ─── HOME ────────────────────────────────────────────────────────────────────

function MHome() {
  const { platform, navigate, setTab } = useMA()
  const { totalDocs, pendingDocs, monthSpend, prevMonthSpend } = useLive()
  const recent = SAMPLE_DOCS.slice(0,4)

  const fmtSpend = (n: number) => {
    if (n >= 1_000_000) return `฿${(n/1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `฿${(n/1_000).toFixed(1).replace(/\.0$/,'')}k`
    return `฿${n.toLocaleString()}`
  }

  const momPct = prevMonthSpend > 0
    ? Math.round(((monthSpend - prevMonthSpend) / prevMonthSpend) * 100)
    : 0
  const momUp = momPct >= 0
  const vatEst = Math.round(monthSpend * 0.065)  // ~VAT portion estimate

  const nowTH = new Date().toLocaleDateString("th-TH", { month: "short", year: "2-digit" })

  return (
    <div className="h-full overflow-y-auto pb-24">
      <div className={cn("px-4 pt-2 pb-3", platform === 'android' && 'bg-white dark:bg-slate-900')}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">สวัสดีตอนเช้า</div>
            <div className="text-[20px] font-bold tracking-tight mt-0.5">คุณ 👋</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate({ type:'search' })} className={cn("flex items-center justify-center", platform==='ios' ? 'h-9 w-9 bg-slate-100 dark:bg-slate-800 rounded-full' : 'h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full')}>
              <Icons.Search size={16}/>
            </button>
            <button onClick={() => navigate({ type:'notifications' })} className={cn("flex items-center justify-center relative", platform==='ios' ? 'h-9 w-9 bg-slate-100 dark:bg-slate-800 rounded-full' : 'h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full')}>
              <Icons.Bell size={16}/>
              {pendingDocs > 0 && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500"/>}
            </button>
          </div>
        </div>
      </div>

      {/* Hero summary card */}
      <div className="px-4">
        <div className={cn("p-4 text-white relative overflow-hidden", platform==='ios' ? 'rounded-[18px]' : 'rounded-[16px]')} style={{ background:'linear-gradient(135deg,#8b5cf6 0%,#6366f1 50%,#4338ca 100%)' }}>
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10"/>
          <div className="absolute right-3 top-3 text-[10px] uppercase tracking-wider opacity-80 font-semibold">{nowTH}</div>
          <div className="relative">
            <div className="text-[10.5px] uppercase tracking-wider opacity-80 font-semibold">ยอดใช้จ่ายเดือนนี้</div>
            <div className="mt-1 text-[28px] font-bold tabular-nums">{fmtSpend(monthSpend)}</div>
            {prevMonthSpend > 0 && (
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-0.5 bg-white/20 px-1.5 py-0.5 rounded-full">
                  {momUp ? <Icons.TrendingUp size={10}/> : <Icons.TrendingDown size={10}/>}
                  {momUp ? '+' : ''}{momPct}%
                </span>
                <span className="opacity-80">จากเดือนก่อน</span>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-white/15 grid grid-cols-3 gap-2">
              <div><div className="text-[16px] font-bold tabular-nums">{totalDocs}</div><div className="text-[9px] uppercase tracking-wider opacity-80">เอกสาร</div></div>
              <div><div className="text-[16px] font-bold tabular-nums">{pendingDocs}</div><div className="text-[9px] uppercase tracking-wider opacity-80">รอตรวจ</div></div>
              <div><div className="text-[16px] font-bold tabular-nums">{fmtSpend(vatEst)}</div><div className="text-[9px] uppercase tracking-wider opacity-80">VAT ~7%</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 mt-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">ทำงานด่วน</div>
        <div className="grid grid-cols-4 gap-2">
          {([
            { ic: <Icons.Camera size={18}/>,   l:'ถ่ายรูป', tone:'brand',   onClick: () => navigate({ type:'capture' }) },
            { ic: <Icons.Upload size={18}/>,   l:'อัปโหลด', tone:'blue',    onClick: () => navigate({ type:'capture' }) },
            { ic: <Icons.QrCode size={18}/>,   l:'LINE',    tone:'emerald',  onClick: () => {} },
            { ic: <Icons.Mail size={18}/>,     l:'ส่งอีเมล', tone:'amber',  onClick: () => {} },
          ] as const).map((a, i) => (
            <button key={i} onClick={a.onClick} className="flex flex-col items-center gap-1.5">
              <span className={cn("h-12 w-12 rounded-[14px] flex items-center justify-center",
                a.tone==='brand'   ? 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300' :
                a.tone==='blue'    ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300' :
                a.tone==='emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300' :
                'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300'
              )}>{a.ic}</span>
              <span className="text-[10.5px] font-medium">{a.l}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pending */}
      {pendingDocs > 0 && (
      <div className="px-4 mt-4">
        <button onClick={() => setTab('docs')} className="w-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-[14px] p-3 flex items-center gap-3 text-left">
          <span className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center"><Icons.Loader size={16}/></span>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold">{pendingDocs} เอกสารรอตรวจสอบ</div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400">ใช้เวลาเพียง 2 นาที</div>
          </div>
          <Icons.ChevronRight size={16} className="text-amber-600 dark:text-amber-300"/>
        </button>
      </div>
      )}

      {/* Recent docs */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">ล่าสุด</div>
          <button onClick={() => setTab('docs')} className="text-[11px] font-semibold text-brand-500">ดูทั้งหมด</button>
        </div>
        <div className="space-y-2">
          {recent.map(d => <MDocRow key={d.id} d={d} onClick={() => navigate({ type:'doc-detail', doc: d })}/>)}
        </div>
      </div>
    </div>
  )
}

function MDocRow({ d, onClick }: { d: Doc; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full bg-white dark:bg-slate-900 rounded-[14px] p-3 flex items-center gap-3 text-left active:scale-[0.99] transition shadow-sm shadow-slate-900/5">
      <span className="h-10 w-10 rounded-[10px] bg-slate-100 dark:bg-slate-800 text-lg flex items-center justify-center shrink-0">{d.thumb}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold truncate">{d.vendor}</div>
        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">{d.category}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-bold tabular-nums">{fmtTHB(d.amount)}</div>
        <div className={cn("text-[9px] font-semibold mt-0.5 uppercase tracking-wider",
          d.status==='approved' ? 'text-emerald-500' : d.status==='reviewing' ? 'text-amber-500' :
          d.status==='pushed'   ? 'text-purple-500'  : d.status==='failed'    ? 'text-rose-500' : 'text-slate-400'
        )}>● {d.status}</div>
      </div>
    </button>
  )
}

// ─── DOCS LIST ────────────────────────────────────────────────────────────────

function MDocs() {
  const { platform, navigate } = useMA()
  const [filter, setFilter] = useState('all')
  // clientNow: null on SSR → no Date.now() hydration mismatch
  const [clientNow, setClientNow] = useState<number | null>(null)
  useEffect(() => { setClientNow(Date.now()) }, [])
  const filters = [
    { id:'all', label:'ทั้งหมด' }, { id:'reviewing', label:'รอตรวจ' },
    { id:'approved', label:'อนุมัติแล้ว' }, { id:'pushed', label:'ส่งเข้าบัญชี' },
  ]
  const filtered = SAMPLE_DOCS.filter(d => filter==='all' || d.status===filter)
  return (
    <div className="h-full flex flex-col">
      <div className={cn("px-4 pt-2", platform==='android' ? 'bg-white dark:bg-slate-900 pb-3 shadow-sm' : 'pb-2')}>
        <div className="flex items-center justify-between">
          <div className="text-[24px] font-bold tracking-tight">เอกสาร</div>
          <button onClick={() => navigate({ type:'search' })} className={cn("flex items-center justify-center", platform==='ios' ? 'h-9 w-9 bg-slate-100 dark:bg-slate-800 rounded-full' : 'h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800')}><Icons.Search size={16}/></button>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-thin">
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cn("shrink-0 h-7 px-3 rounded-full text-[11.5px] font-semibold transition",
              filter===f.id ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            )}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-24 px-4 space-y-2 pt-2">
        {filtered.map(d => (
          <button key={d.id} onClick={() => navigate({ type:'doc-detail', doc: d })} className="w-full bg-white dark:bg-slate-900 rounded-[14px] p-3 flex items-center gap-3 text-left shadow-sm shadow-slate-900/5">
            <span className="h-11 w-11 rounded-[10px] bg-slate-100 dark:bg-slate-800 text-xl flex items-center justify-center shrink-0">{d.thumb}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold truncate">{d.vendor}</div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate" suppressHydrationWarning>{d.category} · {clientNow ? relTime(d.date, clientNow) : '—'}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13px] font-bold tabular-nums">{fmtTHB(d.amount)}</div>
              <span className={cn("inline-block text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full mt-0.5",
                d.status==='approved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' :
                d.status==='reviewing'? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' :
                d.status==='pushed'   ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300' :
                d.status==='failed'   ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}>{d.status}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <div className="text-center text-slate-400 text-[12px] py-12">ไม่พบเอกสาร</div>}
      </div>
    </div>
  )
}

// ─── DOC DETAIL ───────────────────────────────────────────────────────────────

function MDocDetail({ doc }: { doc: Doc }) {
  const { back } = useMA()
  return (
    <div className="h-full flex flex-col">
      <MAppBar title="รายละเอียด" right={<button className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><Icons.MoreHorizontal size={16}/></button>}/>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-4 pt-3">
          <div className="rounded-[14px] bg-white dark:bg-slate-900 p-4 shadow-sm shadow-slate-900/5">
            <div className="text-center text-[10px] font-bold border-b border-slate-200 dark:border-slate-700 pb-2">{doc.vendorEn}</div>
            <div className="text-[7.5px] text-slate-400 text-center mt-0.5">{doc.invoiceNo}</div>
            <div className="mt-3 space-y-1 text-[9px]">
              <div className="flex justify-between"><span>ยอดก่อน VAT</span><span className="tabular-nums">{(doc.amount - doc.vat).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>VAT 7%</span><span className="tabular-nums">{doc.vat.toFixed(2)}</span></div>
            </div>
            <div className="mt-2 pt-2 border-t border-dashed border-slate-300 dark:border-slate-600 flex justify-between text-[11px] font-bold">
              <span>TOTAL</span><span className="tabular-nums">฿{doc.amount.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">ข้อมูล</div>
            <span className="text-[10px] font-semibold text-emerald-500 inline-flex items-center gap-1"><Icons.Sparkles size={10}/>{Math.round((doc.confidence ?? 0.9)*100)}% AI</span>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[14px] divide-y divide-slate-100 dark:divide-slate-800 shadow-sm shadow-slate-900/5">
            {[
              { l:'ผู้ขาย',      v:doc.vendor },
              { l:'หมวดหมู่',    v:doc.category },
              { l:'เลข Invoice', v:doc.invoiceNo, mono:true },
            ].map((r, i) => (
              <div key={i} className="px-3.5 py-2.5 flex items-center justify-between text-[12px]">
                <span className="text-slate-500 dark:text-slate-400">{r.l}</span>
                <span className={cn("font-semibold", r.mono && 'font-mono text-[11px]')}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center gap-2">
        <button className="flex-1 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-[13px] font-semibold">ปฏิเสธ</button>
        <button onClick={back} className="flex-1 h-11 rounded-full bg-brand-500 text-white text-[13px] font-semibold shadow-lg shadow-brand-500/30">อนุมัติ</button>
      </div>
    </div>
  )
}

// ─── CAPTURE ─────────────────────────────────────────────────────────────────

function MCapture() {
  const { navigate, back } = useMA()
  const [flash, setFlash] = useState(false)
  const snap = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 240)
    setTimeout(() => navigate({ type:'capture-review' }), 600)
  }
  return (
    <div className="relative h-full bg-slate-900 text-white overflow-hidden">
      <div className="absolute inset-0" style={{ background:'linear-gradient(180deg,#0f172a 0%,#1e293b 100%)' }}>
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage:'radial-gradient(white 1px,transparent 1px)', backgroundSize:'14px 14px' }}/>
      </div>
      <div className="absolute inset-x-10 top-[16%] bottom-[28%] rounded-[6px] bg-white text-slate-900 p-3 shadow-2xl rotate-[1.5deg]">
        <div className="text-center text-[10px] font-bold border-b border-slate-200 pb-1.5">STARBUCKS COFFEE</div>
        <div className="text-[7.5px] text-slate-400 text-center mt-0.5">Thonglor 10</div>
        <div className="mt-2 space-y-0.5 text-[8px]">
          <div className="flex justify-between"><span>Cappuccino Tall</span><span>110.00</span></div>
          <div className="flex justify-between"><span>Almond Croissant</span><span>75.00</span></div>
        </div>
        <div className="mt-2 pt-1 border-t border-dashed border-slate-300 flex justify-between text-[9.5px] font-bold">
          <span>TOTAL</span><span>185.00</span>
        </div>
      </div>
      {['top-[12%] left-7 border-t-[3px] border-l-[3px]','top-[12%] right-7 border-t-[3px] border-r-[3px]','bottom-[24%] left-7 border-b-[3px] border-l-[3px]','bottom-[24%] right-7 border-b-[3px] border-r-[3px]'].map((c,i) => (
        <span key={i} className={`absolute h-6 w-6 border-emerald-400 rounded-[3px] ${c}`}/>
      ))}
      <div className="absolute top-3 inset-x-0 px-3 flex items-center justify-between">
        <button onClick={back} className="h-9 w-9 bg-black/40 backdrop-blur rounded-full flex items-center justify-center"><Icons.X size={16}/></button>
        <div className="bg-black/40 backdrop-blur px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5"><Icons.Sparkles size={11}/>AI พร้อมแล้ว</div>
        <button className="h-9 w-9 bg-black/40 backdrop-blur rounded-full flex items-center justify-center"><Icons.Zap size={16}/></button>
      </div>
      <div className="absolute bottom-[28%] left-1/2 -translate-x-1/2">
        <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 shadow-lg shadow-emerald-500/40">
          <Icons.Check size={12}/> พบใบเสร็จแล้ว
        </div>
      </div>
      {flash && <div className="absolute inset-0 bg-white z-50"/>}
      <div className="absolute bottom-0 inset-x-0 h-[150px] bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col items-center justify-end pb-6 px-6">
        <div className="flex items-center gap-4 mb-4 text-[11.5px]">
          <span className="text-white/50 font-semibold uppercase tracking-wider">Photo</span>
          <span className="text-amber-400 font-semibold uppercase tracking-wider">Receipt</span>
          <span className="text-white/50 font-semibold uppercase tracking-wider">Multi</span>
        </div>
        <div className="flex items-center justify-between w-full max-w-[280px]">
          <button className="h-12 w-12 rounded-[12px] bg-white/15 backdrop-blur flex items-center justify-center"><Icons.ZoomIn size={20}/></button>
          <button onClick={snap} className="relative">
            <span className="absolute inset-0 rounded-full bg-white/30 animate-pulse-ring"/>
            <span className="relative h-[68px] w-[68px] rounded-full bg-white flex items-center justify-center">
              <span className="h-[58px] w-[58px] rounded-full border-[3px] border-slate-900"/>
            </span>
          </button>
          <button className="h-12 w-12 rounded-[12px] bg-white/15 backdrop-blur flex items-center justify-center"><Icons.RotateCw size={20}/></button>
        </div>
      </div>
    </div>
  )
}

// ─── CAPTURE REVIEW ───────────────────────────────────────────────────────────

function MCaptureReview() {
  const { reset, back } = useMA()
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let t = 0
    const i = setInterval(() => { t += 14; setProgress(Math.min(100,t)); if (t >= 100) clearInterval(i) }, 60)
    return () => clearInterval(i)
  }, [])
  const done = progress >= 100
  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <MAppBar title="ตรวจสอบเอกสาร"/>
      <div className="px-4 pt-3">
        <div className="rounded-[12px] bg-white dark:bg-slate-900 p-3 shadow-sm shadow-slate-900/5 relative">
          <div className="text-center text-[10px] font-bold border-b border-slate-200 dark:border-slate-700 pb-1.5">STARBUCKS · Thonglor 10</div>
          <div className="mt-1.5 space-y-0.5 text-[8.5px] text-slate-700 dark:text-slate-200">
            <div className="flex justify-between"><span>Cappuccino Tall</span><span>110.00</span></div>
            <div className="flex justify-between"><span>Almond Croissant</span><span>75.00</span></div>
          </div>
          <div className="mt-1.5 pt-1 border-t border-dashed border-slate-300 dark:border-slate-700 flex justify-between text-[10px] font-bold">
            <span>TOTAL</span><span>฿185.00</span>
          </div>
          {done && <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">พร้อมแล้ว</span>}
        </div>
      </div>
      {!done ? (
        <div className="px-4 pt-4">
          <div className="bg-brand-500/10 border border-brand-500/30 rounded-[12px] p-3 flex items-center gap-3">
            <Icons.Sparkles size={16} className="text-brand-500 animate-pulse"/>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-brand-700 dark:text-brand-300">AI กำลังอ่านเอกสาร...</div>
              <div className="mt-1.5 h-1.5 rounded-full bg-brand-500/20 overflow-hidden">
                <div className="h-full bg-brand-500 transition-all" style={{ width: progress + '%' }}/>
              </div>
            </div>
            <span className="text-[11px] font-bold text-brand-500 tabular-nums">{progress}%</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-4 px-4 pt-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-500 font-semibold"><Icons.Check size={11}/>ตรวจสอบครบ · ความถูกต้อง 95%</div>
          {[
            { l:'ผู้ขาย', v:'Starbucks Coffee' }, { l:'วันที่', v:'18 พ.ค. 2569' },
            { l:'ยอดรวม', v:'฿185.00', bold:true }, { l:'VAT 7%', v:'฿12.10' },
          ].map((f,i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-[12px] px-3.5 py-2.5 flex items-center justify-between text-[12px] shadow-sm shadow-slate-900/5">
              <span className="text-slate-500 dark:text-slate-400">{f.l}</span>
              <span className={cn("tabular-nums", f.bold ? 'font-bold text-[14px]' : 'font-semibold')}>{f.v}</span>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center gap-2">
        <button onClick={back} className="flex-1 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-[13px] font-semibold">ถ่ายใหม่</button>
        <button onClick={reset} disabled={!done} className={cn("flex-1 h-11 rounded-full text-[13px] font-semibold transition", done ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-400')}>บันทึก</button>
      </div>
    </div>
  )
}

// ─── STATS ────────────────────────────────────────────────────────────────────

function MStats() {
  const { platform } = useMA()
  const { monthSpend, prevMonthSpend, monthlySeries, categories } = useLive()

  const momPct = prevMonthSpend > 0
    ? Math.round(((monthSpend - prevMonthSpend) / prevMonthSpend) * 100)
    : null
  const momUp = (momPct ?? 0) >= 0

  // Use live data if available, fall back to empty
  const data = monthlySeries.length > 0 ? monthlySeries : [
    { m:'—', spend:0 }, { m:'—', spend:0 }, { m:'—', spend:0 },
    { m:'—', spend:0 }, { m:'—', spend:0 }, { m:'—', spend:0 },
  ]
  const cats = categories.length > 0 ? categories : []
  const maxCat = Math.max(...cats.map(c => c.value), 1)

  return (
    <div className="h-full overflow-y-auto pb-24">
      <div className={cn("px-4 pt-2", platform==='android' && 'bg-white dark:bg-slate-900 pb-3 shadow-sm')}>
        <div className="text-[24px] font-bold tracking-tight">รายงาน</div>
        <div className="mt-2 inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[11px]">
          {['Week','Month','Year'].map((p,i) => (
            <button key={p} className={cn("h-7 px-3 rounded-full font-semibold", i===1 ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white' : 'text-slate-500')}>{p}</button>
          ))}
        </div>
      </div>
      <div className="px-4 mt-4">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold">รวมเดือนนี้</div>
        <div className="text-[32px] font-bold tabular-nums">{fmtTHB(monthSpend)}</div>
        {momPct !== null && (
          <div className={cn("text-[11px] inline-flex items-center gap-1 font-semibold", momUp ? 'text-emerald-500' : 'text-rose-500')}>
            {momUp ? <Icons.TrendingUp size={11}/> : <Icons.TrendingDown size={11}/>}
            {momUp ? '+' : ''}{momPct}% vs เดือนก่อน
          </div>
        )}
      </div>
      <div className="px-4 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-[14px] p-3 shadow-sm shadow-slate-900/5">
          <svg viewBox="0 0 280 120" className="w-full">
            <defs>
              <linearGradient id="m-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6366f1" stopOpacity="0.35"/><stop offset="1" stopColor="#6366f1" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {(() => {
              const max = Math.max(...data.map(d => d.spend), 1)
              const pts = data.map((d,i) => [12 + i*(256/(data.length-1)), 100-(d.spend/max)*80] as [number,number])
              const path = pts.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')
              return (<>
                <path d={path+` L ${pts[pts.length-1][0]} 110 L ${pts[0][0]} 110 Z`} fill="url(#m-grad)"/>
                <path d={path} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                {pts.map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="white" stroke="#6366f1" strokeWidth="2"/>)}
                {data.map((d,i) => <text key={i} x={12+i*(256/(data.length-1))} y="118" textAnchor="middle" fontSize="9" fill="#94a3b8">{d.m}</text>)}
              </>)
            })()}
          </svg>
        </div>
      </div>
      <div className="px-4 mt-4">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold mb-2">ตามหมวดหมู่</div>
        {cats.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[14px] divide-y divide-slate-100 dark:divide-slate-800 shadow-sm shadow-slate-900/5">
            {cats.map(c => (
              <div key={c.name} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="inline-flex items-center gap-2 truncate"><span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background:c.color }}/>{c.name}</span>
                  <span className="font-semibold tabular-nums shrink-0">{fmtTHB(c.value)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full" style={{ width:(c.value/maxCat)*100+'%', background:c.color }}/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-400 text-[12px] py-8">ยังไม่มีข้อมูลหมวดหมู่</div>
        )}
      </div>
    </div>
  )
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

function MProfile() {
  const { navigate } = useMA()
  const { orgName, orgPlan, orgRole } = useLive()
  return (
    <div className="h-full overflow-y-auto pb-24">
      <div className="px-4 pt-2 pb-3">
        <div className="text-[24px] font-bold tracking-tight">โปรไฟล์</div>
      </div>
      <div className="px-4 mt-2">
        <div className="bg-white dark:bg-slate-900 rounded-[16px] p-4 flex items-center gap-3 shadow-sm shadow-slate-900/5">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white flex items-center justify-center font-bold text-[20px]">
            {orgName ? orgName[0].toUpperCase() : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold truncate">{orgName}</div>
            <span className="inline-block mt-1 text-[9.5px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-300 px-2 py-0.5 rounded-full capitalize">
              {orgPlan} · {orgRole}
            </span>
          </div>
          <Icons.ChevronRight size={16} className="text-slate-400"/>
        </div>
      </div>
      <div className="px-4 mt-3">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 px-1">องค์กร</div>
        <div className="bg-white dark:bg-slate-900 rounded-[14px] divide-y divide-slate-100 dark:divide-slate-800 shadow-sm shadow-slate-900/5">
          <div className="px-3.5 py-2.5 flex items-center gap-3">
            <span className="h-8 w-8 rounded-[8px] bg-gradient-to-br from-brand-400 to-brand-700 text-white flex items-center justify-center">
              <Icons.Building size={14}/>
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate">{orgName}</div>
              <div className="text-[9.5px] uppercase tracking-wider text-slate-400 font-medium">{orgPlan} · {orgRole}</div>
            </div>
            <Icons.Check size={15} className="text-brand-500"/>
          </div>
        </div>
      </div>
      <div className="px-4 mt-3 space-y-2">
        {([
          { ic:<Icons.Bell size={15}/>,        l:'แจ้งเตือน',              r:'On',      tone:'amber' },
          { ic:<Icons.ShieldCheck size={15}/>, l:'ความปลอดภัย & Face ID', r:'',        tone:'emerald' },
          { ic:<Icons.Plug size={15}/>,        l:'การเชื่อมต่อ',           r:'2',       tone:'purple' },
          { ic:<Icons.CreditCard size={15}/>,  l:'การชำระเงิน',            r:'Pro',     tone:'brand' },
          { ic:<Icons.Moon size={15}/>,        l:'ธีม',                   r:'อัตโนมัติ', tone:'slate' },
        ] as const).map((r,i) => (
          <button key={i} onClick={() => navigate({type:'settings'})} className="w-full bg-white dark:bg-slate-900 rounded-[12px] px-3.5 py-3 flex items-center gap-3 shadow-sm shadow-slate-900/5">
            <span className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center",
              r.tone==='brand'   ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' :
              r.tone==='emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' :
              r.tone==='amber'   ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' :
              r.tone==='purple'  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300' :
              'bg-slate-100 text-slate-500 dark:bg-slate-800'
            )}>{r.ic}</span>
            <span className="flex-1 text-left text-[12.5px] font-semibold">{r.l}</span>
            {r.r && <span className="text-[11px] text-slate-500">{r.r}</span>}
            <Icons.ChevronRight size={15} className="text-slate-400"/>
          </button>
        ))}
      </div>
      <div className="px-4 mt-4">
        <button className="w-full h-11 rounded-[12px] bg-white dark:bg-slate-900 text-rose-500 text-[12.5px] font-semibold shadow-sm shadow-slate-900/5">ออกจากระบบ</button>
      </div>
    </div>
  )
}

// ─── Sub-screens ──────────────────────────────────────────────────────────────

function MNotifications() {
  const { back } = useMA()
  const groups = [
    { title:'วันนี้', items:[
      { ic:<Icons.Sparkles size={14}/>, tone:'brand',   title:'AI อ่านเสร็จ 3 ใบ',        sub:'พร้อมตรวจสอบ · 7-Eleven, Grab, Lazada', time:'9:18' },
      { ic:<Icons.Send size={14}/>,     tone:'purple',  title:'ส่งเข้า FlowAccount แล้ว', sub:'AWS Cloud · ฿8,750', time:'9:04' },
      { ic:<Icons.AlertTriangle size={14}/>, tone:'amber', title:'ต้องตรวจสอบ',           sub:'Grab · ความถูกต้อง 78%', time:'8:42' },
    ]},
    { title:'เมื่อวาน', items:[
      { ic:<Icons.QrCode size={14}/>,   tone:'emerald', title:'เชื่อมต่อ LINE สำเร็จ',   sub:'Slippy Bot · บริษัท เอบีซี', time:'18:20' },
      { ic:<Icons.Users size={14}/>,    tone:'blue',    title:'สมาชิกใหม่',              sub:'somying@abc.co.th · Admin',  time:'14:11' },
    ]},
  ]
  return (
    <div className="h-full flex flex-col">
      <MAppBar title="การแจ้งเตือน" right={<button className="text-[12px] text-brand-500 font-semibold pr-1.5">อ่านทั้งหมด</button>}/>
      <div className="flex-1 overflow-y-auto pb-4 px-4">
        {groups.map((g,gi) => (
          <div key={gi} className="mt-3">
            <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 px-1">{g.title}</div>
            <div className="bg-white dark:bg-slate-900 rounded-[14px] divide-y divide-slate-100 dark:divide-slate-800 shadow-sm shadow-slate-900/5">
              {g.items.map((n,i) => (
                <div key={i} className="px-3.5 py-3 flex gap-3">
                  <span className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                    n.tone==='brand'  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' :
                    n.tone==='purple' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300' :
                    n.tone==='amber'  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' :
                    n.tone==='emerald'? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' :
                    'bg-blue-500/10 text-blue-600 dark:text-blue-300'
                  )}>{n.ic}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold">{n.title}</div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400">{n.sub}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MSearch() {
  const [q, setQ] = useState('')
  const filtered = SAMPLE_DOCS.filter(d => !q || (d.vendor+d.vendorEn).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="h-full flex flex-col">
      <MAppBar title="ค้นหา"/>
      <div className="px-4 pt-2">
        <div className="relative">
          <Icons.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหาผู้ขาย, ยอด, วันที่..." className="w-full h-10 rounded-full bg-slate-100 dark:bg-slate-800 pl-9 pr-3 text-[12.5px] outline-none"/>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 mt-3 pb-4 space-y-2">
        {q ? filtered.map(d => <MDocRow key={d.id} d={d} onClick={()=>{}}/>)
           : (
          <>
            <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold mt-2">ค้นหาล่าสุด</div>
            {['Starbucks','AWS','Grab','7-Eleven'].map(s => (
              <button key={s} onClick={()=>setQ(s)} className="w-full bg-white dark:bg-slate-900 rounded-[10px] px-3 py-2.5 flex items-center gap-2.5 text-left shadow-sm shadow-slate-900/5">
                <Icons.Search size={13} className="text-slate-400"/>
                <span className="text-[12px]">{s}</span>
              </button>
            ))}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['สัปดาห์นี้','มากกว่า ฿1,000','รอตรวจ','AWS','Grab'].map(c => (
                <button key={c} className="px-3 h-7 rounded-full bg-white dark:bg-slate-900 text-[11px] font-semibold shadow-sm">{c}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MSettings() {
  return (
    <div className="h-full flex flex-col">
      <MAppBar title="ตั้งค่า"/>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 pt-3">
        {([
          { title:'การแจ้งเตือน', items:[
            { l:'เอกสารต้องตรวจสอบ', toggle:true },
            { l:'AI อ่านเสร็จ',      toggle:true },
            { l:'รายงานประจำสัปดาห์', toggle:false },
          ]},
          { title:'ความปลอดภัย', items:[
            { l:'ปลดล็อกด้วย Face ID', toggle:true },
            { l:'ขอ PIN ทุกครั้ง',      toggle:false },
            { l:'ออกระบบอัตโนมัติ',    value:'30 min' },
          ]},
        ] as const).map((g,gi) => (
          <div key={gi}>
            <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 px-1">{g.title}</div>
            <div className="bg-white dark:bg-slate-900 rounded-[14px] divide-y divide-slate-100 dark:divide-slate-800 shadow-sm shadow-slate-900/5">
              {g.items.map((it,i) => <MSettingRow key={i} item={it as any}/>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MSettingRow({ item }: { item: { l: string; toggle?: boolean; value?: string } }) {
  const { platform } = useMA()
  const [on, setOn] = useState(item.toggle ?? false)
  if (item.toggle !== undefined) return (
    <div className="px-3.5 py-2.5 flex items-center justify-between">
      <span className="text-[12px]">{item.l}</span>
      <button onClick={() => setOn(!on)} className={cn("transition-colors", platform==='ios'
        ? cn("h-[28px] w-[46px] rounded-full p-0.5", on ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")
        : cn("h-[18px] w-[32px] rounded-full p-0 relative", on ? "bg-brand-500/40" : "bg-slate-300 dark:bg-slate-700")
      )}>
        {platform==='ios' ? (
          <span className={cn("block h-6 w-6 rounded-full bg-white shadow transition-transform", on ? 'translate-x-[18px]' : 'translate-x-0')}/>
        ) : (
          <span className={cn("absolute top-1/2 -translate-y-1/2 h-[22px] w-[22px] rounded-full shadow transition-all", on ? 'left-[12px] bg-brand-500' : 'left-[-2px] bg-white dark:bg-slate-200')}/>
        )}
      </button>
    </div>
  )
  return (
    <div className="px-3.5 py-2.5 flex items-center justify-between">
      <span className="text-[12px]">{item.l}</span>
      <span className="text-[11.5px] text-slate-500 inline-flex items-center gap-1">{item.value}<Icons.ChevronRight size={12} className="text-slate-400"/></span>
    </div>
  )
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────

function MBottomNav() {
  const { platform, tab, setTab, navigate } = useMA()
  const items = [
    { id:'home',    ic:<Icons.Dashboard size={18}/>, l:'หน้าหลัก' },
    { id:'docs',    ic:<Icons.FileText  size={18}/>, l:'เอกสาร' },
    { id:'capture', ic:<Icons.Camera    size={22}/>, l:'ถ่าย',    fab:true },
    { id:'stats',   ic:<Icons.BarChart  size={18}/>, l:'รายงาน' },
    { id:'profile', ic:<Icons.User      size={18}/>, l:'โปรไฟล์' },
  ]
  return (
    <div className={cn("absolute bottom-0 inset-x-0 grid grid-cols-5 px-2 z-30",
      platform==='ios'
        ? "h-[78px] bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800"
        : "h-[68px] bg-white dark:bg-slate-900 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
    )}>
      {items.map(n => {
        if (n.fab) return (
          <div key={n.id} className="flex items-center justify-center relative">
            <button onClick={() => navigate({ type:'capture' })} className={cn("absolute flex items-center justify-center bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-xl shadow-brand-500/40",
              platform==='ios' ? '-top-4 h-[56px] w-[56px] rounded-[18px]' : '-top-5 h-[56px] w-[56px] rounded-[16px]'
            )}>{n.ic}</button>
          </div>
        )
        const active = tab === n.id
        return (
          <button key={n.id} onClick={() => setTab(n.id)} className={cn("flex flex-col items-center justify-center gap-0.5 transition-colors", active ? 'text-brand-500' : 'text-slate-400')}>
            <span className={cn(active && platform==='android' && 'bg-brand-500/15 px-3.5 py-1 rounded-full')}>{n.ic}</span>
            <span className="text-[9.5px] font-medium">{n.l}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Feature Frames ───────────────────────────────────────────────────────────

function FeatureFrame({ children, title, desc, platform, forceios, forceandroid }: {
  children: React.ReactNode; title: string; desc: string
  platform: string; forceios?: boolean; forceandroid?: boolean
}) {
  const p = forceios ? 'ios' : forceandroid ? 'android' : platform
  return (
    <div className="rounded-[12px] border bg-card p-5 flex flex-col">
      <div className="flex items-center justify-center mb-5 relative" style={{ minHeight: 480 }}>
        <PhoneFrame platform={p} size="sm">{children}</PhoneFrame>
      </div>
      <div className="font-semibold text-foreground text-[14px]">{title}</div>
      <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
    </div>
  )
}

function FFMultiScan() {
  return (
    <div className="h-full bg-slate-900 text-white relative">
      <div className="absolute inset-0" style={{ background:'linear-gradient(180deg,#0f172a 0%,#1e293b 100%)' }}/>
      <div className="absolute inset-0 flex flex-col items-center pt-8">
        <div className="relative" style={{ width:130, height:120 }}>
          {[2,1,0].map(i => (
            <div key={i} className="absolute bg-white text-slate-900 rounded-[4px] p-2 shadow-lg" style={{ width:110, top:i*10, left:i*8-8, zIndex:5-i, transform:`rotate(${(i-1)*3}deg)` }}>
              <div className="text-center text-[7px] font-bold border-b border-slate-200 pb-0.5">RECEIPT #{3-i}</div>
              <div className="mt-1 space-y-0.5 text-[6px]">
                <div className="flex justify-between"><span>Item</span><span>{(120+i*30).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Item</span><span>{(85+i*15).toFixed(2)}</span></div>
              </div>
              <div className="mt-0.5 pt-0.5 border-t border-dashed border-slate-300 flex justify-between text-[7px] font-bold">
                <span>TOTAL</span><span>{(205+i*45).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-3 inset-x-3">
        <div className="bg-emerald-500 text-white text-[10.5px] font-semibold px-3 py-1.5 rounded-full text-center">3 หน้า · กดเพื่อแสกนต่อ</div>
      </div>
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px]">
        <button className="h-7 w-7 bg-black/40 backdrop-blur rounded-full flex items-center justify-center"><Icons.X size={12}/></button>
        <span className="bg-black/40 backdrop-blur px-2.5 py-1 rounded-full font-medium">Multi-scan</span>
        <button className="h-7 w-7 bg-black/40 backdrop-blur rounded-full flex items-center justify-center"><Icons.Check size={12}/></button>
      </div>
    </div>
  )
}

function FFBiometric() {
  return (
    <div className="h-full bg-gradient-to-b from-slate-900 to-brand-900 text-white flex flex-col items-center justify-center p-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-brand-400/30 animate-pulse-ring"/>
        <div className="relative h-20 w-20 rounded-full bg-white/10 border-2 border-brand-300/50 backdrop-blur flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C6 2 6 8 6 12s0 10 6 10 6-6 6-10S18 2 12 2z"/><path d="M9 9c1-1.5 4.5-1.5 6 0"/><path d="M9 12c1 2 4 3 6 0"/><path d="M9 15c1.5 2 4 1 6-1"/></svg>
        </div>
      </div>
      <div className="mt-6 text-[14px] font-semibold">Face ID</div>
      <div className="text-[11px] text-white/70 mt-1">มองที่กล้องเพื่อปลดล็อก</div>
      <div className="mt-5 flex items-center gap-2 text-[10.5px] text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/>กำลังสแกน...
      </div>
      <button className="mt-6 text-[11px] text-brand-300 font-semibold">ใช้รหัสผ่านแทน</button>
    </div>
  )
}

function FFShare() {
  return (
    <div className="h-full bg-slate-100 dark:bg-slate-900 relative">
      <div className="absolute inset-x-0 top-0 bottom-[42%] bg-white dark:bg-slate-800 opacity-50"/>
      <div className="absolute inset-x-3 bottom-3 top-[35%] bg-white dark:bg-slate-900 rounded-t-[18px] shadow-2xl flex flex-col">
        <div className="pt-2 pb-1 flex justify-center"><span className="h-1 w-9 rounded-full bg-slate-300"/></div>
        <div className="px-4 pt-2 pb-3 text-[11.5px] font-bold text-center">แชร์ใบเสร็จ</div>
        <div className="flex items-center gap-3 px-4 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="h-10 w-10 rounded-[8px] bg-slate-200 dark:bg-slate-800 text-base flex items-center justify-center">🧾</div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold truncate">IMG_2541.heic</div>
            <div className="text-[9.5px] text-slate-500">2.1 MB · รูปภาพ</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 p-3">
          {[
            { ic:<LogoMark size={32}/>, l:'Slippy', hi:true },
            { ic:<span className="h-8 w-8 rounded-[8px] bg-emerald-500 text-white flex items-center justify-center font-bold text-[14px]">L</span>, l:'LINE' },
            { ic:<span className="h-8 w-8 rounded-[8px] bg-blue-500 text-white flex items-center justify-center font-bold text-[14px]">M</span>, l:'Mail' },
            { ic:<span className="h-8 w-8 rounded-[8px] bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><Icons.MoreHorizontal size={14}/></span>, l:'More' },
          ].map((a,i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className={cn("flex items-center justify-center", a.hi && 'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-slate-900 rounded-[8px]')}>{a.ic}</span>
              <span className="text-[8.5px] text-slate-700 dark:text-slate-200">{a.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FFPush({ platform }: { platform: string }) {
  if (platform === 'android') return (
    <div className="h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 relative px-3 pt-12">
      <div className="text-center text-white">
        <div className="text-[36px] font-light tracking-tight">9:41</div>
        <div className="text-[11px] opacity-80">จันทร์ที่ 18 พ.ค.</div>
      </div>
      <div className="mt-5 bg-white/95 dark:bg-slate-800/95 backdrop-blur rounded-[16px] p-3 shadow-2xl">
        <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300 mb-1.5">
          <LogoMark size={14}/><span className="font-semibold">SLIPPY</span><span className="opacity-50">· now</span>
        </div>
        <div className="text-[11.5px] font-bold text-slate-900 dark:text-white">AI อ่านเสร็จแล้ว 3 ใบ ✨</div>
        <div className="text-[10.5px] text-slate-600 dark:text-slate-300 mt-0.5">7-Eleven, Grab, Lazada พร้อมตรวจสอบ</div>
        <div className="mt-2 flex items-center gap-1.5">
          <button className="flex-1 h-6 rounded-full bg-brand-500 text-white text-[9.5px] font-semibold">ตรวจสอบทันที</button>
          <button className="h-6 px-3 rounded-full bg-slate-200 dark:bg-slate-700 text-[9.5px] font-semibold">ภายหลัง</button>
        </div>
      </div>
    </div>
  )
  return (
    <div className="h-full bg-gradient-to-br from-rose-100 via-orange-100 to-amber-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 relative px-3 pt-10">
      <div className="text-center text-slate-800 dark:text-white">
        <div className="text-[38px] font-light tracking-tight">9:41</div>
        <div className="text-[11px] opacity-80">วันจันทร์ที่ 18 พฤษภาคม</div>
      </div>
      <div className="mt-5 bg-white/80 backdrop-blur-xl rounded-[18px] p-3 shadow-xl border border-white/40">
        <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
          <LogoMark size={14}/><span className="font-semibold">SLIPPY</span><span className="opacity-50">· now</span>
        </div>
        <div className="text-[11.5px] font-semibold text-slate-900">AI อ่านเสร็จแล้ว 3 ใบ ✨</div>
        <div className="text-[10.5px] text-slate-600 mt-0.5">7-Eleven, Grab, Lazada พร้อมตรวจสอบ</div>
      </div>
    </div>
  )
}

function FFWidget() {
  return (
    <div className="h-full bg-gradient-to-br from-rose-50 via-purple-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-3 pt-10">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({length:8}).map((_,i) => (
          <div key={i} className="aspect-square rounded-[10px] bg-white/50 dark:bg-slate-700/50 backdrop-blur"/>
        ))}
      </div>
      <div className="mt-3">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-[18px] p-3.5 shadow-xl">
          <div className="flex items-center gap-1.5">
            <LogoMark size={18}/>
            <span className="text-[10.5px] font-semibold uppercase tracking-wider">Slippy</span>
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-wider opacity-80 font-semibold">พ.ค. 2026</div>
          <div className="text-[22px] font-bold tabular-nums">฿142,380</div>
          <div className="text-[10px] mt-1 flex items-center gap-1.5">
            <span className="bg-white/20 px-1.5 py-0.5 rounded">+8%</span>
            <span>47 เอกสาร</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function FFOffline() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-3 py-1.5 text-[10px] font-semibold flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>ออฟไลน์ · 4 ใบรอ sync
      </div>
      <div className="flex-1 overflow-hidden px-3 pt-3 space-y-2">
        {[
          { v:'7-Eleven',  a:'285.00',   done:false },
          { v:'Grab',      a:'120.00',   done:false },
          { v:'Starbucks', a:'185.00',   done:false },
          { v:'AWS',       a:'8,750.00', done:true  },
        ].map((d,i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-[10px] px-3 py-2 flex items-center gap-2.5 shadow-sm">
            <span className={cn("h-7 w-7 rounded-full flex items-center justify-center", d.done ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600')}>
              {d.done ? <Icons.Check size={12}/> : <Icons.Loader size={12}/>}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold truncate">{d.v}</div>
              <div className="text-[9.5px] text-slate-500">{d.done ? 'อัปโหลดแล้ว' : 'รอ sync'}</div>
            </div>
            <div className="text-[10px] font-bold tabular-nums">฿{d.a}</div>
          </div>
        ))}
      </div>
      <div className="p-3">
        <button className="w-full h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5">
          <Icons.Loader size={12} className="animate-spin"/>จะ sync เมื่อต่อเน็ต
        </button>
      </div>
    </div>
  )
}

function FFDynamicIsland() {
  return (
    <div className="h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage:'radial-gradient(circle at 20% 30%,#818cf8 0%,transparent 50%),radial-gradient(circle at 80% 70%,#ec4899 0%,transparent 50%)' }}/>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black text-white rounded-[20px] px-3 py-2 flex items-center gap-2 shadow-2xl" style={{ width:180 }}>
        <LogoMark size={20}/>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-semibold opacity-80">AI กำลังอ่าน</div>
          <div className="text-[10px] font-bold truncate">Starbucks · 185.00</div>
        </div>
        <div className="relative h-6 w-6">
          <svg viewBox="0 0 24 24" className="h-6 w-6">
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
            <circle cx="12" cy="12" r="9" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeDasharray="56.5" strokeDashoffset="20" strokeLinecap="round" transform="rotate(-90 12 12)"/>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">64%</span>
        </div>
      </div>
      <div className="absolute bottom-4 inset-x-3 text-center text-[10px] text-slate-700 dark:text-slate-300">
        <div className="font-semibold">Dynamic Island</div>
        <div className="opacity-70 mt-0.5">ดูสถานะ OCR ที่ไหนก็ได้บน iPhone</div>
      </div>
    </div>
  )
}

function FFMaterialYou() {
  const palettes = [['#fde68a','#f59e0b','#92400e'],['#bbf7d0','#10b981','#064e3b'],['#a5b4fc','#6366f1','#312e81'],['#fda4af','#e11d48','#881337']]
  return (
    <div className="h-full bg-white dark:bg-slate-900 p-3 space-y-2">
      <div className="text-[11px] font-bold">เลือกธีมสี</div>
      {palettes.map((p,i) => (
        <button key={i} className={cn("w-full rounded-[12px] p-2.5 flex items-center gap-2 bg-slate-50 dark:bg-slate-800", i===2 && 'ring-2 ring-brand-500')}>
          <div className="flex">
            {p.map((c,j) => <span key={j} className="h-7 w-7 rounded-full border-2 border-white dark:border-slate-900" style={{ background:c, marginLeft:j>0?-10:0 }}/>)}
          </div>
          <span className="text-[10.5px] font-semibold flex-1 text-left ml-2">Palette {i+1}</span>
          {i===2 && <Icons.Check size={14} className="text-brand-500"/>}
        </button>
      ))}
      <div className="bg-brand-500 text-white text-[10px] rounded-[10px] p-2.5 text-center font-semibold">
        แอปจะปรับสีตามวอลล์เปเปอร์ของคุณ
      </div>
    </div>
  )
}

function FFLocation() {
  return (
    <div className="h-full bg-slate-100 dark:bg-slate-900 relative">
      <div className="absolute inset-0" style={{
        background:'linear-gradient(135deg,#dbeafe 0%,#f3e8ff 50%,#fef3c7 100%)',
        backgroundImage:'linear-gradient(rgba(99,102,241,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.06) 1px,transparent 1px)',
        backgroundSize:'24px 24px'
      }}/>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 220 460" preserveAspectRatio="none">
        <path d="M 0 200 Q 60 160 120 200 T 220 240" stroke="#94a3b8" strokeWidth="3" fill="none" opacity="0.6"/>
        <path d="M 0 300 Q 80 280 150 310 T 220 340" stroke="#94a3b8" strokeWidth="2" fill="none" opacity="0.5"/>
      </svg>
      <div className="absolute top-[42%] left-[50%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <span className="absolute inset-0 h-10 w-10 rounded-full bg-brand-500/30 animate-pulse-ring"/>
          <span className="relative h-10 w-10 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-xl shadow-brand-500/40">
            <Icons.Receipt size={16}/>
          </span>
        </div>
      </div>
      <div className="absolute inset-x-3 bottom-3 bg-white dark:bg-slate-800 rounded-[14px] p-3 shadow-2xl">
        <div className="text-[9.5px] uppercase tracking-wider text-slate-500 font-semibold">ผูกกับร้านอัตโนมัติ</div>
        <div className="mt-1 text-[12px] font-bold text-slate-900 dark:text-white">Starbucks · ทองหล่อ 10</div>
        <div className="text-[10px] text-slate-500 mt-0.5">180 ม. จากตำแหน่งคุณ</div>
      </div>
    </div>
  )
}

// ─── Download card ────────────────────────────────────────────────────────────

function DownloadCard({ kind }: { kind: 'ios'|'android'|'huawei' }) {
  const data = {
    ios:     { label:'App Store',   sub:'iOS 16+',  icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg> },
    android: { label:'Play Store',  sub:'Android 10+', icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.76c.3.17.64.19.96.08L14.17 12 3.14.16C2.82.05 2.48.07 2.18.24 1.6.57 1.25 1.24 1.25 2v20c0 .76.35 1.43.93 1.76zM16.35 9.83l2.5-2.5c.57-.57.84-1.31.84-2.06 0-.74-.27-1.48-.84-2.06L16.35.71l-.91.91 2.5 2.5-2.5 2.5.91.91z"/></svg> },
    huawei:  { label:'AppGallery', sub:'Huawei',    icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3"/></svg> },
  }[kind]
  return (
    <button className="bg-card border border-border rounded-[12px] p-3 flex items-center gap-2 hover:border-brand-400 transition">
      <span className="text-foreground shrink-0">{data.icon}</span>
      <div className="text-left min-w-0">
        <div className="text-[9.5px] text-muted-foreground uppercase tracking-wider">ดาวน์โหลด</div>
        <div className="text-[12px] font-semibold text-foreground truncate">{data.label}</div>
      </div>
    </button>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function MobileClient(props: MobileClientProps) {
  const [platform, setPlatform] = useState<'ios'|'android'>('ios')

  return (
    <LiveDataCtx.Provider value={props}>
    <div className="p-6 lg:p-7 space-y-10 max-w-[1400px] animate-fade-in">

      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-full mb-2">
            <Icons.Smartphone size={10}/> Mobile App
          </div>
          <h2 className="text-[24px] font-bold text-foreground tracking-tight">Slippy ในกระเป๋าคุณ</h2>
          <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">
            ถ่ายรูปใบเสร็จที่ร้านได้ทันที — Slippy อ่าน บันทึก และส่งเข้าระบบบัญชีให้เองภายในไม่กี่วินาที พร้อมใช้งานทั้ง iOS และ Android
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-muted rounded-[10px]">
            <button onClick={() => setPlatform('ios')} className={cn("h-9 px-3.5 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 transition",
              platform==='ios' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
            )}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              iOS
            </button>
            <button onClick={() => setPlatform('android')} className={cn("h-9 px-3.5 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 transition",
              platform==='android' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
            )}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.7-.4l-1.86 3.23a11.4 11.4 0 0 0-9.76 0L5.26 5.9a.4.4 0 0 0-.7.4l1.83 3.18C3.21 11.27 1 14.61 1 18.5h22c0-3.89-2.21-7.23-5.4-9.02zM7 15.25a1 1 0 1 1 .01-2 1 1 0 0 1-.01 2zm10 0a1 1 0 1 1 .01-2 1 1 0 0 1-.01 2z"/></svg>
              Android
            </button>
          </div>
        </div>
      </div>

      {/* Interactive phone + instructions */}
      <div className="relative">
        <div className="absolute inset-0 glow-radial opacity-60 pointer-events-none" style={{ maskImage:'radial-gradient(circle at center,black,transparent 70%)' }}/>
        <div className="relative grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 lg:gap-12 items-center">
          {/* Phone */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative">
              <div className="absolute -inset-8 rounded-[60px] bg-gradient-to-br from-brand-500/30 to-violet-500/20 blur-3xl"/>
              <div className="relative">
                <PhoneFrame platform={platform} size="lg">
                  <MobileApp platform={platform}/>
                </PhoneFrame>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">ทดลองใช้แอป</div>
            <h3 className="text-[22px] font-bold text-foreground tracking-tight">แตะที่ตรงไหนก็ได้ — ทำงานจริง</h3>
            <p className="text-[13.5px] text-muted-foreground leading-relaxed">
              นำทางผ่านเมนูล่าง สลับ tab, ดูเอกสาร, ลองกดถ่ายรูป, ตั้งค่า, เปิดการแจ้งเตือน — ทุกหน้าใช้งานได้จริง
            </p>
            <ul className="space-y-2 text-[12.5px] mt-3">
              {[
                'แตะ "ถ่าย" ตรงกลาง → กดชัตเตอร์ → ดู AI ดึงข้อมูล',
                'เลื่อนแถบ tab "เอกสาร" → กดเอกสารเพื่อดูรายละเอียด',
                'ไปที่ "โปรไฟล์" → ลองเปิด/ปิด Face ID, การแจ้งเตือน',
                'ดูสไตล์ iOS vs Android — switch toggle ด้านบน',
              ].map((p,i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300 text-[10px] font-bold flex items-center justify-center mt-0.5 shrink-0">{i+1}</span>
                  <span className="text-foreground">{p}</span>
                </li>
              ))}
            </ul>
            <div className="pt-4 grid grid-cols-3 gap-3">
              <DownloadCard kind="ios"/>
              <DownloadCard kind="android"/>
              <DownloadCard kind="huawei"/>
            </div>
          </div>
        </div>
      </div>

      {/* Feature gallery */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">ฟีเจอร์เฉพาะมือถือ</div>
        <h3 className="text-[20px] font-bold text-foreground tracking-tight mb-5">ใช้พลังของมือถือให้เต็มที่</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureFrame title="แสกนแบบ Multi-page"    desc="ใบกำกับยาวๆ ถ่ายต่อกันได้ทันที"         platform={platform}><FFMultiScan/></FeatureFrame>
          <FeatureFrame title="Face ID / Biometric"   desc="ปลอดภัยกว่ารหัสผ่าน · ใช้ลายนิ้วมือก็ได้" platform={platform}><FFBiometric/></FeatureFrame>
          <FeatureFrame title="Share Extension"       desc="แชร์รูปจากแอปไหนก็เข้า Slippy ได้"     platform={platform}><FFShare/></FeatureFrame>
          <FeatureFrame title="แจ้งเตือนผลักดัน"       desc="รู้ทันทีเมื่อ AI ทำงานเสร็จ"             platform={platform}><FFPush platform={platform}/></FeatureFrame>
          <FeatureFrame title="Widget หน้าจอหลัก"     desc="ยอดเดือนนี้ที่หน้าแรกของคุณ"             platform={platform}><FFWidget/></FeatureFrame>
          <FeatureFrame title="ทำงาน Offline"         desc="ถ่ายไว้ก่อน Sync ทีหลัง"                platform={platform}><FFOffline/></FeatureFrame>
          <FeatureFrame title="Live Activity / Dynamic Island" desc="ดูสถานะ OCR ที่หน้า lock screen" platform="ios" forceios><FFDynamicIsland/></FeatureFrame>
          <FeatureFrame title="Material You · ปรับสีตามวอลล์เปเปอร์" desc="ปรับสีแอปตามภาพพื้นหลังของคุณ" platform="android" forceandroid><FFMaterialYou/></FeatureFrame>
          <FeatureFrame title="ระบุตำแหน่งร้าน"       desc="ผูกใบเสร็จกับร้านที่คุณซื้อ"            platform={platform}><FFLocation/></FeatureFrame>
        </div>
      </div>

      {/* All capabilities */}
      <div className="rounded-[12px] border bg-card p-6">
        <h3 className="text-[15px] font-semibold text-foreground">ทุกความสามารถบนมือถือ</h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[13px]">
          {[
            { ic:<Icons.Camera size={14}/>,      th:'ถ่ายรูปใบเสร็จ + auto-crop' },
            { ic:<Icons.ZoomIn size={14}/>,      th:'เลือกจากคลังภาพ' },
            { ic:<Icons.FileText size={14}/>,    th:'แสกน PDF / multi-page' },
            { ic:<Icons.QrCode size={14}/>,      th:'แสกน QR PromptPay / สลิป' },
            { ic:<Icons.Bell size={14}/>,        th:'Push notifications' },
            { ic:<Icons.ShieldCheck size={14}/>, th:'Face ID / Touch ID' },
            { ic:<Icons.Download size={14}/>,    th:'Offline mode + sync' },
            { ic:<Icons.Send size={14}/>,        th:'Share extension' },
            { ic:<Icons.Smartphone size={14}/>,  th:'Geo-tag ผู้ขาย' },
            { ic:<Icons.Sparkles size={14}/>,    th:'Voice notes / dictation' },
            { ic:<Icons.Zap size={14}/>,         th:'Live Activity (iOS)' },
            { ic:<Icons.Dashboard size={14}/>,   th:'Home widget' },
            { ic:<Icons.Users size={14}/>,       th:'Multi-org switching' },
            { ic:<Icons.Mail size={14}/>,        th:'Email forward to Slippy' },
            { ic:<Icons.Moon size={14}/>,        th:'Auto dark mode' },
            { ic:<Icons.Upload size={14}/>,      th:'Export CSV / PDF จากมือถือ' },
            { ic:<Icons.Receipt size={14}/>,     th:'Apple/Google Wallet receipts' },
            { ic:<Icons.Zap size={14}/>,         th:'Haptic feedback' },
          ].map((f,i) => (
            <div key={i} className="flex items-center gap-2.5 py-1">
              <span className="h-7 w-7 rounded-[8px] bg-muted text-brand-600 dark:text-brand-300 flex items-center justify-center shrink-0">{f.ic}</span>
              <span className="text-foreground">{f.th}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </LiveDataCtx.Provider>
  )
}
