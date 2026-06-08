"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState, useMemo } from "react"
import { toast } from "sonner"
import { Copy, Plus, Camera, MoreHorizontal, Zap, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// FlowAccount และ PEAK ซ่อนไว้ก่อน — รอ API approval
// const SHOW_ACCOUNTING_PUSH = false

const ACCOUNTING_APPS: { id: string; name: string; desc: string; logo: string; color: string; soon?: boolean }[] = [
  // FlowAccount: hidden — waiting for Open API approval
  // { id: "flowaccount", name: "FlowAccount", desc: "ส่งเอกสารเข้าระบบบัญชีอัตโนมัติ", logo: "F", color: "bg-emerald-500" },
  // PEAK: hidden — no public API
  // { id: "peak", name: "PEAK Account", desc: "เร็วๆ นี้", logo: "P", color: "bg-orange-500", soon: true },
  // Express: hidden — no API yet
  // { id: "express", name: "Express Accounting", desc: "เร็วๆ นี้", logo: "E", color: "bg-blue-500", soon: true },
  { id: "gsheets", name: "Google Sheets", desc: "Export อัตโนมัติเข้าสเปรดชีท", logo: "G", color: "bg-green-600" },
]

const CONNECT_CODE = "SLPY-7K4Q-8XYZ"

interface Props {
  orgId: string; orgSlug: string
  integrations: any[]; lineConnections: any[]
  userRole: string
}

function QrCodePattern({ code }: { code: string }) {
  const cells = 21
  const grid = useMemo(() => {
    let seed = 0
    for (let i = 0; i < code.length; i++) seed = seed * 31 + code.charCodeAt(i)
    const r = (n: number) => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 < n }
    return Array.from({ length: cells }, () => Array.from({ length: cells }, () => r(0.45)))
  }, [code])
  const corners: [number, number][] = [[0, 0], [0, cells - 7], [cells - 7, 0]]
  const isFinder = (x: number, y: number) =>
    corners.some(([cx, cy]) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7)
  return (
    <svg viewBox={`0 0 ${cells} ${cells}`} className="w-full h-full p-2">
      <rect x="0" y="0" width={cells} height={cells} fill="white" />
      {grid.map((row, y) => row.map((on, x) =>
        !isFinder(x, y) && on
          ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0f172a" />
          : null
      ))}
      {corners.map(([cx, cy], i) => (
        <g key={i}>
          <rect x={cx} y={cy} width="7" height="7" fill="none" stroke="#0f172a" strokeWidth="1" />
          <rect x={cx + 2} y={cy + 2} width="3" height="3" fill="#0f172a" />
        </g>
      ))}
    </svg>
  )
}

const LINE_MESSAGES = [
  { from: "user", kind: "text", text: "/connect SLPY-7K4Q-8XYZ", t: "09:12" },
  { from: "bot",  kind: "text", text: "🎉 เชื่อมต่อกับ บริษัท เอบีซี จำกัด สำเร็จ!\nส่งรูปสลิปมาได้เลยครับ", t: "09:12" },
  { from: "user", kind: "image", t: "09:18" },
  { from: "bot",  kind: "typing" },
  { from: "bot",  kind: "card", t: "09:18",
    title: "7-Eleven (สาขาทองหล่อ 24)",
    lines: [
      { l: "วันที่", v: "18/05/2026" },
      { l: "ยอดรวม", v: "฿118.00", bold: true },
      { l: "VAT", v: "฿7.71" },
    ],
    confidence: 98,
  },
  { from: "bot",  kind: "text", text: "✅ บันทึกแล้ว · เอกสารพร้อมส่งเข้า FlowAccount", t: "09:18" },
  { from: "user", kind: "text", text: "/summary", t: "09:20" },
  { from: "bot",  kind: "text",
    text: "📊 พฤษภาคม 2026 · บริษัท เอบีซี\n• เอกสาร: 47 ใบ (+12%)\n• ยอดรวม: ฿142,380\n• VAT ซื้อ: ฿9,307\n• รอตรวจสอบ: 8 ใบ",
    t: "09:20"
  },
]

function LineBubble({ m }: { m: any }) {
  const isBot  = m.from === "bot"
  const wrapCx = `flex ${isBot ? "justify-start" : "justify-end"}`
  const bubbleCx =
    "max-w-[80%] rounded-[14px] px-3 py-2 text-[12px] leading-snug whitespace-pre-line break-words " +
    (isBot ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
           : "bg-[#06C755] text-white")

  if (m.kind === "typing") return (
    <div className={wrapCx}>
      <div className="bg-white dark:bg-slate-800 rounded-[14px] px-3 py-2 shadow-sm flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  )

  if (m.kind === "image") return (
    <div className={wrapCx}>
      <div className="bg-[#06C755] rounded-[14px] p-1 max-w-[180px]">
        <div className="rounded-[10px] overflow-hidden bg-white p-3 text-slate-900">
          <div className="text-center text-[8.5px] font-bold border-b border-slate-200 pb-1">7-ELEVEN · ทองหล่อ 24</div>
          <div className="mt-1.5 space-y-0.5 text-[7.5px]">
            <div className="flex justify-between"><span>Coffee Americano</span><span>55.00</span></div>
            <div className="flex justify-between"><span>Sandwich</span><span>49.00</span></div>
            <div className="flex justify-between"><span>Water 600ml</span><span>14.00</span></div>
          </div>
          <div className="mt-1 pt-1 border-t border-dashed border-slate-300 flex justify-between text-[8.5px] font-bold">
            <span>TOTAL</span><span>118.00</span>
          </div>
        </div>
        <div className="text-[9px] text-white/80 text-right px-1 pt-0.5">{m.t}</div>
      </div>
    </div>
  )

  if (m.kind === "card") return (
    <div className={wrapCx}>
      <div className="bg-white dark:bg-slate-800 rounded-[14px] overflow-hidden shadow-sm w-[230px]">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 px-3 py-2.5 text-white flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold truncate">{m.title}</div>
            <div className="text-[9px] opacity-80">AI ดึงข้อมูลแล้ว</div>
          </div>
          <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">{m.confidence}%</span>
        </div>
        <div className="px-3 py-2 space-y-1">
          {m.lines.map((l: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">{l.l}</span>
              <span className={cn("text-slate-900 dark:text-white tabular-nums", l.bold ? "font-bold" : "font-medium")}>
                {l.v}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-700 text-[10.5px] font-semibold">
          <button className="py-2 text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">แก้ไข</button>
          <button className="py-2 text-brand-600 dark:text-brand-400">อนุมัติ</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={wrapCx}>
      <div className={bubbleCx}>
        {m.text}
        <div className={`text-[9px] mt-0.5 ${isBot ? "text-slate-400" : "text-white/70"}`}>{m.t}</div>
      </div>
    </div>
  )
}

export function IntegrationsClient({ orgId, orgSlug: _orgSlug, integrations, lineConnections, userRole }: Props) {
  const canManage = ["owner", "admin"].includes(userRole)
  const [showQR,  setShowQR]  = useState(false)
  const [flowConnected] = useState(integrations.some(i => i.provider === "flowaccount" && i.is_active))

  // Real connect code from API
  const [connectCode, setConnectCode] = useState<string | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [copied,      setCopied]      = useState(false)

  const generateConnectCode = async () => {
    setCodeLoading(true)
    try {
      const res = await fetch("/api/line/connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      })
      const data = await res.json()
      if (res.ok) setConnectCode(data.code)
      else toast.error(data.error ?? "สร้าง code ไม่สำเร็จ")
    } catch {
      toast.error("เกิดข้อผิดพลาด")
    }
    setCodeLoading(false)
  }

  const copyCode = () => {
    const code = connectCode ?? CONNECT_CODE
    navigator.clipboard?.writeText(`/connect ${code}`)
    setCopied(true)
    toast.success("คัดลอกคำสั่งแล้ว")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* [LINE Bot section removed — rendered separately by LineSection component] */}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start" style={{ display: "none" }}>
        {/* LINE Bot card (hidden) */}
        <div className="bg-card border border-border rounded-[12px] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">
            {/* Left: steps */}
            <div className="p-6 lg:p-7 space-y-5">
              <div className="flex items-center gap-3">
                <span className="h-12 w-12 rounded-[12px] bg-green-500 text-white flex items-center
                  justify-center font-bold text-lg shrink-0">L</span>
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">@slippy</h3>
                  <p className="text-[12px] text-muted-foreground">
                    พร้อมใช้งาน · เชื่อมแล้ว {lineConnections.length || 2} บัญชี
                  </p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
                  text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ใช้งานได้
                </span>
              </div>

              <ol className="space-y-3">
                {[
                  "เพิ่ม @slippy ใน LINE ของคุณ",
                  "ส่งคำสั่ง /connect พร้อมรหัสด้านขวา",
                  "ส่งรูปสลิป — Slippy อ่านและอัปโหลดให้เอง",
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="h-7 w-7 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300
                      text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-sm text-foreground pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>

              <div className="flex items-center gap-2 p-3 rounded-[10px] bg-muted">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[12px] text-foreground">
                  คำสั่งอื่นใน LINE: /summary, /status, /help
                </span>
              </div>
            </div>

            {/* Right: Connect code */}
            <div className="bg-muted/40 p-6 border-l border-border flex flex-col items-center justify-center text-center gap-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                รหัสเชื่อมต่อ
              </div>

              {connectCode ? (
                <>
                  {/* Show generated code with QR */}
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="relative h-32 w-32 rounded-[12px] bg-card border border-border flex items-center
                      justify-center hover:shadow-md transition-shadow overflow-hidden">
                    {showQR
                      ? <QrCodePattern code={connectCode} />
                      : <span className="font-mono text-xl font-black text-foreground tracking-wider">{connectCode}</span>
                    }
                  </button>
                  <div className="rounded-[8px] bg-card border border-border px-3 py-2 font-mono text-sm font-bold tracking-wider text-foreground">
                    /connect {connectCode}
                  </div>
                  <button onClick={copyCode}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-600 dark:text-brand-400 hover:underline">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "คัดลอกแล้ว" : "คัดลอกคำสั่ง"}
                  </button>
                  <p className="text-[11px] text-muted-foreground">หมดอายุใน 15 นาที</p>
                </>
              ) : (
                <>
                  <div className="h-32 w-32 rounded-[12px] bg-card border border-border flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-14 h-14 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none" />
                      <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none" />
                      <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                  {canManage ? (
                    <button
                      onClick={generateConnectCode}
                      disabled={codeLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-brand-500 hover:bg-brand-600
                        text-white text-sm font-semibold transition-colors disabled:opacity-60">
                      {codeLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Plus className="w-4 h-4" />
                      }
                      สร้าง Connect Code
                    </button>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">ติดต่อ Admin เพื่อสร้าง code</p>
                  )}
                </>
              )}

              {/* dummy hidden button to preserve old copyCode reference below */}
              <button style={{ display: "none" }} onClick={copyCode}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium
                  text-brand-600 dark:text-brand-400 hover:underline">
                <Copy className="w-3 h-3" /> คัดลอก
              </button>
              <p className="text-[10.5px] text-muted-foreground mt-3">รหัสนี้ใช้ได้ 24 ชั่วโมง</p>
            </div>
          </div>
        </div>

        {/* LINE chat preview */}
        <div className="bg-card border border-border rounded-[12px] overflow-hidden lg:sticky lg:top-[73px]">
          <div className="bg-[#06C755] text-white px-4 py-3 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-white text-[#06C755] flex items-center justify-center font-bold text-[15px]">
              S
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px]">Slippy Bot</div>
              <div className="text-[10.5px] opacity-85 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                ออนไลน์ · ตอบกลับทันที
              </div>
            </div>
            <MoreHorizontal className="w-4 h-4" />
          </div>
          <div className="bg-[#7EAFC9]/15 dark:bg-slate-900/40 px-3 py-4 space-y-2 max-h-[420px] overflow-y-auto">
            {LINE_MESSAGES.map((m, i) => <LineBubble key={i} m={m} />)}
          </div>
          <div className="px-3 py-2.5 border-t border-border bg-card flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
              <Plus className="w-3.5 h-3.5" />
            </span>
            <div className="flex-1 h-8 rounded-full bg-muted text-[12px] text-muted-foreground px-3 flex items-center">
              พิมพ์ข้อความ...
            </div>
            <span className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
              <Camera className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Connector cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ACCOUNTING_APPS.map(app => {
          const existing  = integrations.find(i => i.provider === app.id)
          const connected = app.id === "flowaccount" ? flowConnected : !!existing?.is_active
          return (
            <div key={app.id} className="bg-card border border-border rounded-[12px] p-5">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "h-11 w-11 rounded-[10px] text-white flex items-center justify-center font-bold text-base shrink-0",
                  app.color
                )}>{app.logo}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{app.name}</h3>
                    {app.soon && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium
                        bg-muted text-muted-foreground">เร็วๆ นี้</span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{app.desc}</p>
                </div>
                {app.id === "flowaccount" ? (
                  connected ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]
                        font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> เชื่อมแล้ว
                      </span>
                      <button
                        onClick={() => {}}
                        className="text-[12px] text-rose-600 dark:text-rose-400 hover:underline">
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={!canManage}
                      className="h-8 px-3 rounded-[8px] bg-brand-500 hover:bg-brand-600 text-white text-xs
                        font-medium transition-colors disabled:opacity-60 shrink-0">
                      เชื่อมต่อ
                    </button>
                  )
                ) : (
                  <button
                    disabled={!!app.soon}
                    className="h-8 px-3 rounded-[8px] border border-border bg-card text-xs font-medium
                      text-foreground hover:bg-muted transition-colors disabled:opacity-50 shrink-0">
                    {app.soon ? "เร็วๆ นี้" : "เชื่อมต่อ"}
                  </button>
                )}
              </div>

              {app.id === "flowaccount" && connected && (
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[18px] font-bold text-foreground tabular-nums">237</div>
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wider">ส่งสำเร็จ</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">3</div>
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wider">ล้มเหลว</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-foreground tabular-nums">2h</div>
                    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wider">sync ล่าสุด</div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
