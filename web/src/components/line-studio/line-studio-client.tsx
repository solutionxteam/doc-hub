"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Copy, Check, RefreshCw, Trash2, ChevronRight, QrCode,
  Zap, FileText, Users, MessageCircle, Settings, BarChart2,
  Clock, CheckCircle2, AlertCircle, Loader, Send, Bot,
  Link2, ShieldCheck, Webhook, Code2, ExternalLink, ChevronDown,
} from "lucide-react"

/* ─── Static demo data ────────────────────────────────────────────────────── */

const BOT_INFO = {
  name:       "@slippy_bot",
  channelId:  "2006712345",
  status:     "active" as const,
  webhook:    "https://api.slippy.app/webhook/line",
  connectedAt:"2025-08-15",
  msgTotal:   1_284,
  slipTotal:  412,
  autoRate:   94,
}

const CONNECTED_ACCOUNTS = [
  {
    id: "la1",
    displayName: "นภัทร เจริญพร",
    lineUserId:  "Uf3a8b2c9d1e0f47",
    pictureUrl:  null,
    linkedEmail: "napat@abc.co.th",
    role:        "owner",
    connectedAt: "2025-08-16T09:12:00",
    msgCount:    684,
    slipCount:   221,
    lastActive:  "2026-05-17T10:24:00",
  },
  {
    id: "la2",
    displayName: "สมหญิง รักการบัญชี",
    lineUserId:  "Ua7c3f1e5b8d24190",
    pictureUrl:  null,
    linkedEmail: "somying@abc.co.th",
    role:        "admin",
    connectedAt: "2025-11-13T14:05:00",
    msgCount:    388,
    slipCount:   142,
    lastActive:  "2026-05-16T18:30:00",
  },
  {
    id: "la3",
    displayName: "พีท นักพัฒนา",
    lineUserId:  "Ub9d2e6a4c7f38210",
    pictureUrl:  null,
    linkedEmail: "pete@abc.co.th",
    role:        "member",
    connectedAt: "2026-03-22T09:44:00",
    msgCount:    212,
    slipCount:   49,
    lastActive:  "2026-05-15T11:40:00",
  },
]

type ActivityType = "slip_ok" | "slip_fail" | "cmd_status" | "cmd_report" | "cmd_connect" | "unknown"

const ACTIVITY: {
  id: string; from: string; type: ActivityType; text: string; time: string; docId?: string; amount?: number
}[] = [
  { id:"a1", from:"นภัทร เจริญพร",       type:"slip_ok",     text:"ใบเสร็จ Amazon Web Services", time:"2026-05-17T10:24:00", docId:"AWS-1188372",    amount:8750 },
  { id:"a2", from:"สมหญิง รักการบัญชี",  type:"cmd_status",  text:"/status",                     time:"2026-05-17T09:55:00" },
  { id:"a3", from:"นภัทร เจริญพร",       type:"slip_ok",     text:"บมจ. ซีพี ออลล์ (7-Eleven)", time:"2026-05-17T09:12:00", docId:"INV-7E-23984",   amount:285 },
  { id:"a4", from:"พีท นักพัฒนา",        type:"slip_fail",   text:"AIS Fibre (อ่านไม่ออก)",     time:"2026-05-15T11:40:00" },
  { id:"a5", from:"สมหญิง รักการบัญชี",  type:"slip_ok",     text:"Starbucks Coffee",            time:"2026-05-15T09:02:00", docId:"SB-0515-2244",   amount:185 },
  { id:"a6", from:"พีท นักพัฒนา",        type:"cmd_report",  text:"/report เดือนนี้",            time:"2026-05-14T16:30:00" },
  { id:"a7", from:"สมหญิง รักการบัญชี",  type:"slip_ok",     text:"บจก. โอเอ็ม พร็อพเพอร์ตี้", time:"2026-05-14T14:15:00", docId:"OM-2605-0014",   amount:35000 },
  { id:"a8", from:"นภัทร เจริญพร",       type:"cmd_status",  text:"/status",                     time:"2026-05-13T10:00:00" },
]

const COMMANDS = [
  { cmd:"/connect {code}", desc:"เชื่อมบัญชี LINE กับองค์กร",   example:"/connect A7X3K2" },
  { cmd:"/status",         desc:"ดูสถานะเอกสารและโควต้าเดือนนี้", example:"/status" },
  { cmd:"/report",         desc:"ขอรายงานสรุปค่าใช้จ่าย",        example:"/report เดือนนี้" },
  { cmd:"/help",           desc:"แสดงคำสั่งทั้งหมดที่ใช้ได้",    example:"/help" },
]

const MONTHLY_MSGS = [
  { m:"ธ.ค.", n:78 }, { m:"ม.ค.", n:95 }, { m:"ก.พ.", n:88 },
  { m:"มี.ค.", n:110 }, { m:"เม.ย.", n:124 }, { m:"พ.ค.", n:67 },
]

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = diff / 60000
  if (m < 60)  return `${Math.round(m)} นาทีที่แล้ว`
  const h = m / 60
  if (h < 24)  return `${Math.round(h)} ชม.ที่แล้ว`
  return `${Math.round(h / 24)} วันที่แล้ว`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"2-digit" })
}

function fmtTHB(n: number) {
  return "฿" + n.toLocaleString("th-TH")
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()
}

const roleColors: Record<string,string> = {
  owner:      "bg-amber-500/10 text-amber-600",
  admin:      "bg-brand-500/10 text-brand-600",
  accountant: "bg-purple-500/10 text-purple-600",
  member:     "bg-slate-500/10 text-slate-600",
}
const roleTH: Record<string,string> = {
  owner:"Owner", admin:"Admin", accountant:"Accountant", member:"Member"
}

const activityMeta: Record<ActivityType, { icon: React.FC<{className?:string}>, color: string, label: string }> = {
  slip_ok:      { icon: ({ className }) => <CheckCircle2 className={className} />, color:"text-emerald-500", label:"สลิปสำเร็จ" },
  slip_fail:    { icon: ({ className }) => <AlertCircle className={className} />,  color:"text-rose-500",    label:"สลิปล้มเหลว" },
  cmd_status:   { icon: ({ className }) => <BarChart2 className={className} />,    color:"text-brand-500",   label:"คำสั่ง" },
  cmd_report:   { icon: ({ className }) => <FileText className={className} />,     color:"text-purple-500",  label:"คำสั่ง" },
  cmd_connect:  { icon: ({ className }) => <Link2 className={className} />,        color:"text-teal-500",    label:"เชื่อมต่อ" },
  unknown:      { icon: ({ className }) => <MessageCircle className={className} />,color:"text-slate-400",   label:"อื่นๆ" },
}

const avatarColors = ["bg-brand-500","bg-purple-500","bg-teal-500","bg-amber-500","bg-rose-500"]

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5 flex gap-4 items-start">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", accent ?? "bg-[#06C755]/10")}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground leading-tight">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function AccountCard({ acc, onDisconnect }: {
  acc: typeof CONNECTED_ACCOUNTS[number]; onDisconnect: (id: string) => void
}) {
  const color = avatarColors[CONNECTED_ACCOUNTS.indexOf(acc) % avatarColors.length]
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors">
      {/* Avatar */}
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0", color)}>
        {initials(acc.displayName)}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{acc.displayName}</p>
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", roleColors[acc.role])}>
            {roleTH[acc.role]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{acc.linkedEmail}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] text-muted-foreground">{acc.slipCount} สลิป · {acc.msgCount} ข้อความ</span>
          <span className="text-[11px] text-muted-foreground/60">ใช้ล่าสุด {relTime(acc.lastActive)}</span>
        </div>
      </div>
      {/* Stats */}
      <div className="hidden sm:flex flex-col items-end gap-1">
        <p className="text-xs text-muted-foreground">เชื่อมต่อ {fmtDate(acc.connectedAt)}</p>
        <p className="text-[11px] font-mono text-muted-foreground/60 truncate max-w-[140px]">{acc.lineUserId}</p>
      </div>
      {/* Remove */}
      <button
        onClick={() => onDisconnect(acc.id)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
        title="ยกเลิกการเชื่อมต่อ"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function ActivityFeed({ items }: { items: typeof ACTIVITY }) {
  return (
    <div className="divide-y">
      {items.map(item => {
        const meta = activityMeta[item.type]
        const Icon = meta.icon
        const isSlip = item.type === "slip_ok" || item.type === "slip_fail"
        return (
          <div key={item.id} className="flex gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              item.type === "slip_ok"   ? "bg-emerald-500/10" :
              item.type === "slip_fail" ? "bg-rose-500/10" :
              "bg-brand-500/10"
            )}>
              <Icon className={cn("w-3.5 h-3.5", meta.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold">{item.from}</span>
                  <span className="text-xs text-muted-foreground mx-1.5">·</span>
                  <span className={cn("text-[10px] font-semibold", meta.color)}>{meta.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{relTime(item.time)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-foreground/80 truncate">{item.text}</p>
                {isSlip && item.amount && (
                  <span className="text-xs font-semibold text-foreground/60 shrink-0">{fmtTHB(item.amount)}</span>
                )}
              </div>
              {isSlip && item.docId && (
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{item.docId}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MiniBarChart({ data }: { data: typeof MONTHLY_MSGS }) {
  const max = Math.max(...data.map(d => d.n))
  return (
    <div className="flex items-end gap-1.5 h-14">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={cn(
              "w-full rounded-t-sm transition-all",
              i === data.length - 1 ? "bg-[#06C755]" : "bg-[#06C755]/30"
            )}
            style={{ height: `${(d.n / max) * 100}%` }}
          />
          <span className="text-[9px] text-muted-foreground">{d.m}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Connect code panel ──────────────────────────────────────────────────── */

function ConnectPanel() {
  const [code,    setCode]    = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [tab,     setTab]     = useState<"code"|"qr">("code")

  const generate = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setCode("A7X3K2")
    setLoading(false)
  }

  const copy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(`/connect ${code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 rounded-lg bg-[#06C755]/10 flex items-center justify-center">
            <Link2 className="w-3.5 h-3.5 text-[#06C755]" />
          </div>
          <p className="font-semibold text-sm">เชื่อมต่อบัญชี LINE ใหม่</p>
        </div>
        <p className="text-xs text-muted-foreground">สร้าง Connect Code แล้วส่งให้ผู้ใช้พิมพ์ใน LINE Bot</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Tab */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(["code","qr"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-md font-medium transition-all",
                tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "code" ? "Connect Code" : "QR Code"}
            </button>
          ))}
        </div>

        {tab === "code" ? (
          <div className="space-y-3">
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border font-medium
                hover:bg-muted transition-colors disabled:opacity-60 w-full justify-center"
            >
              {loading
                ? <Loader className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              {code ? "สร้างโค้ดใหม่" : "สร้าง Connect Code"}
            </button>

            {code && (
              <div className="rounded-xl border bg-[#06C755]/5 border-[#06C755]/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">ส่งคำสั่งนี้ใน LINE Bot (หมดอายุใน 15 นาที)</p>
                  <span className="flex items-center gap-1 text-[10px] text-[#06C755]">
                    <Clock className="w-3 h-3" />15:00
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-background px-3 py-2 rounded-lg border font-semibold tracking-wider">
                    /connect {code}
                  </code>
                  <button
                    onClick={copy}
                    className="p-2 rounded-lg border hover:bg-muted transition-colors shrink-0"
                  >
                    {copied
                      ? <Check className="w-4 h-4 text-emerald-500" />
                      : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  ให้ผู้ใช้เพิ่ม <span className="font-semibold text-foreground">{BOT_INFO.name}</span> เป็นเพื่อน
                  แล้วพิมพ์คำสั่งด้านบน
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            {/* Fake QR — just a visual placeholder */}
            <div className="w-40 h-40 rounded-2xl bg-white border-2 border-[#06C755]/30 flex items-center justify-center relative overflow-hidden">
              <svg viewBox="0 0 80 80" className="w-32 h-32" fill="none">
                {/* Corner squares */}
                <rect x="4" y="4" width="20" height="20" rx="2" fill="#111" />
                <rect x="6" y="6" width="16" height="16" rx="1.5" fill="white" />
                <rect x="8" y="8" width="12" height="12" rx="1" fill="#111" />
                <rect x="56" y="4" width="20" height="20" rx="2" fill="#111" />
                <rect x="58" y="6" width="16" height="16" rx="1.5" fill="white" />
                <rect x="60" y="8" width="12" height="12" rx="1" fill="#111" />
                <rect x="4" y="56" width="20" height="20" rx="2" fill="#111" />
                <rect x="6" y="58" width="16" height="16" rx="1.5" fill="white" />
                <rect x="8" y="60" width="12" height="12" rx="1" fill="#111" />
                {/* Dots pattern */}
                {[32,36,40,44,48].map(x => [32,36,40,44,48].map(y =>
                  Math.random() > 0.45 ? <rect key={`${x}${y}`} x={x} y={y} width="3" height="3" fill="#111" /> : null
                ))}
                <rect x="32" y="32" width="3" height="3" fill="#06C755" />
                <rect x="40" y="36" width="3" height="3" fill="#06C755" />
                <rect x="36" y="44" width="3" height="3" fill="#06C755" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              สแกน QR Code เพื่อเพิ่ม <span className="font-semibold text-foreground">{BOT_INFO.name}</span> เป็นเพื่อน
            </p>
            <a
              href="#"
              className="text-xs text-[#06C755] hover:underline flex items-center gap-1"
              onClick={e => e.preventDefault()}
            >
              <ExternalLink className="w-3 h-3" />
              เปิดใน LINE
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Webhook config section ─────────────────────────────────────────────── */

function WebhookConfig() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string|null>(null)

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-500/10 flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">การตั้งค่า Webhook</p>
            <p className="text-xs text-muted-foreground">Channel ID · Webhook URL · Token</p>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          {[
            { label:"Channel ID",   value:BOT_INFO.channelId,   key:"cid" },
            { label:"Webhook URL",  value:BOT_INFO.webhook,     key:"wh" },
          ].map(({ label, value, key }) => (
            <div key={key}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-muted/50 px-3 py-2 rounded-lg border truncate">
                  {value}
                </code>
                <button
                  onClick={() => copy(value, key)}
                  className="p-1.5 rounded-lg border hover:bg-muted transition-colors shrink-0"
                >
                  {copied === key
                    ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}

          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2.5 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Webhook ทำงานปกติ · ตรวจสอบล่าสุด 2 นาทีที่แล้ว
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Commands reference ─────────────────────────────────────────────────── */

function CommandCard({ cmd, desc, example }: { cmd: string; desc: string; example: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(example)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 space-y-1.5 hover:border-[#06C755]/30 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <code className="text-sm font-mono font-semibold text-[#06C755]">{cmd}</code>
        <button
          onClick={copy}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
        >
          {copied
            ? <Check className="w-3.5 h-3.5 text-emerald-500" />
            : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <code className="text-[11px] text-muted-foreground/70 font-mono">{example}</code>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function LineStudioClient() {
  const [accounts, setAccounts] = useState(CONNECTED_ACCOUNTS)
  const [activeTab, setActiveTab] = useState<"activity"|"accounts"|"commands">("activity")

  const disconnect = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="p-6 lg:p-7 max-w-[1080px] animate-fade-in space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#06C755] flex items-center justify-center shadow-lg shadow-[#06C755]/25">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
              <path d="M12 2C6.48 2 2 5.92 2 10.77c0 2.94 1.67 5.55 4.23 7.22-.1.38-.67 2.44-.69 2.56 0 0-.02.15.08.21.1.06.21.03.21.03.27-.04 3.2-2.07 3.63-2.37.83.14 1.67.22 2.54.22 5.52 0 10-3.92 10-8.77C22 5.92 17.52 2 12 2z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">LINE Studio</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ออนไลน์
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {BOT_INFO.name} · จัดการ LINE Bot สำหรับรับสลิปและรายงาน
            </p>
          </div>
        </div>
        <a
          href="https://manager.line.biz"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border hover:bg-muted transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          LINE Official Account Manager
        </a>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<MessageCircle className="w-5 h-5 text-[#06C755]" />}
          label="ข้อความรับแล้ว"
          value={BOT_INFO.msgTotal.toLocaleString()}
          sub="ตั้งแต่เริ่มใช้งาน"
        />
        <StatCard
          icon={<FileText className="w-5 h-5 text-[#06C755]" />}
          label="สลิปจาก LINE"
          value={BOT_INFO.slipTotal.toLocaleString()}
          sub={`auto-approve ${BOT_INFO.autoRate}%`}
          accent="bg-[#06C755]/10"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-[#06C755]" />}
          label="บัญชีที่เชื่อมต่อ"
          value={accounts.length}
          sub="สมาชิกในองค์กร"
          accent="bg-[#06C755]/10"
        />
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">ข้อความ 6 เดือน</p>
          <MiniBarChart data={MONTHLY_MSGS} />
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">

        {/* Left: Activity + Accounts + Commands */}
        <div className="space-y-4">

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-muted/60 rounded-xl w-fit">
            {([
              { key:"activity",  label:"กิจกรรม" },
              { key:"accounts",  label:`บัญชี (${accounts.length})` },
              { key:"commands",  label:"คำสั่ง Bot" },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                  activeTab === t.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Activity tab */}
          {activeTab === "activity" && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b flex items-center justify-between">
                <p className="text-sm font-semibold">กิจกรรมล่าสุด</p>
                <span className="text-xs text-muted-foreground">อัปเดตอัตโนมัติ</span>
              </div>
              <ActivityFeed items={ACTIVITY} />
              <div className="px-5 py-3 border-t">
                <button className="text-xs text-[#06C755] hover:underline flex items-center gap-1">
                  ดูทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Accounts tab */}
          {activeTab === "accounts" && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b flex items-center justify-between">
                <p className="text-sm font-semibold">บัญชีที่เชื่อมต่อ</p>
                <span className="text-xs text-muted-foreground">{accounts.length} บัญชี</span>
              </div>
              {accounts.length > 0
                ? <div className="divide-y">
                    {accounts.map(a => (
                      <AccountCard key={a.id} acc={a} onDisconnect={disconnect} />
                    ))}
                  </div>
                : <div className="py-12 text-center text-muted-foreground">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">ยังไม่มีบัญชี LINE ที่เชื่อมต่อ</p>
                  </div>
              }
            </div>
          )}

          {/* Commands tab */}
          {activeTab === "commands" && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-[#06C755]/5 border-[#06C755]/20 px-5 py-4 flex gap-3">
                <Bot className="w-5 h-5 text-[#06C755] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">คำสั่งที่รองรับทั้งหมด</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ผู้ใช้สามารถส่งสลิปโดยตรงได้เลย หรือใช้คำสั่งด้านล่าง
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {COMMANDS.map((c, i) => <CommandCard key={i} {...c} />)}
              </div>

              {/* Bot reply preview */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-5 py-3.5 border-b">
                  <p className="text-sm font-semibold">ตัวอย่างการโต้ตอบ Bot</p>
                </div>
                <div className="p-5 space-y-3">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-[#06C755] text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[70%]">
                      /status
                    </div>
                  </div>
                  {/* Bot reply */}
                  <div className="flex justify-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#06C755] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                        <path d="M12 2C6.48 2 2 5.92 2 10.77c0 2.94 1.67 5.55 4.23 7.22-.1.38-.67 2.44-.69 2.56 0 0-.02.15.08.21.1.06.21.03.21.03.27-.04 3.2-2.07 3.63-2.37.83.14 1.67.22 2.54.22 5.52 0 10-3.92 10-8.77C22 5.92 17.52 2 12 2z"/>
                      </svg>
                    </div>
                    <div className="bg-muted text-sm px-4 py-3 rounded-2xl rounded-tl-sm max-w-[75%] space-y-1">
                      <p className="font-semibold text-[#06C755]">🤖 Slippy Bot</p>
                      <p>📊 <span className="font-semibold">สถานะ พ.ค. 2026</span></p>
                      <p className="text-muted-foreground">เอกสาร: 47 รายการ</p>
                      <p className="text-muted-foreground">ค่าใช้จ่ายรวม: ฿142,380</p>
                      <p className="text-muted-foreground">โควต้า: 47/1,000</p>
                    </div>
                  </div>
                  {/* Slip message */}
                  <div className="flex justify-end">
                    <div className="bg-[#06C755] text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[70%]">
                      🧾 [รูปสลิป]
                    </div>
                  </div>
                  {/* Bot reply */}
                  <div className="flex justify-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#06C755] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                        <path d="M12 2C6.48 2 2 5.92 2 10.77c0 2.94 1.67 5.55 4.23 7.22-.1.38-.67 2.44-.69 2.56 0 0-.02.15.08.21.1.06.21.03.21.03.27-.04 3.2-2.07 3.63-2.37.83.14 1.67.22 2.54.22 5.52 0 10-3.92 10-8.77C22 5.92 17.52 2 12 2z"/>
                      </svg>
                    </div>
                    <div className="bg-muted text-sm px-4 py-3 rounded-2xl rounded-tl-sm max-w-[75%] space-y-1">
                      <p className="font-semibold text-emerald-600">✅ บันทึกสำเร็จ!</p>
                      <p className="text-muted-foreground">Amazon Web Services</p>
                      <p className="font-semibold">฿8,750.00</p>
                      <p className="text-muted-foreground text-xs">VAT 7% = ฿571.96</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Connect + Webhook */}
        <div className="space-y-4">
          <ConnectPanel />
          <WebhookConfig />

          {/* Bot stats mini card */}
          <div className="rounded-xl border bg-card px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold">ประสิทธิภาพ Bot</p>
            </div>
            <div className="space-y-2">
              {[
                { label:"Auto-approve rate",  pct:94, color:"bg-emerald-500" },
                { label:"OCR สำเร็จ",         pct:91, color:"bg-brand-500" },
                { label:"ตอบสนองเฉลี่ย <2s", pct:98, color:"bg-[#06C755]" },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-semibold">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", color)} style={{ width:`${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl border bg-card px-5 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">เคล็ดลับ</p>
            <div className="space-y-2.5">
              {[
                "ส่งสลิปโดยตรงไปยัง Bot ได้เลย ไม่ต้องพิมพ์คำสั่ง",
                "Bot จะตอบกลับทันทีพร้อมยอดเงินที่อ่านได้",
                "ใช้ /report เพื่อขอสรุปค่าใช้จ่ายรายเดือน",
                "Admin สามารถยกเลิกการเชื่อมต่อได้ที่หน้านี้",
              ].map((tip, i) => (
                <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-[#06C755]/10 text-[#06C755] flex items-center justify-center text-[9px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
