"use client"

import { Zap, Plus, Camera, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

const MSGS = [
  { from:"user", text:"/connect 7C8M6V" },
  { from:"bot",  text:"🎉 เชื่อมต่อสำเร็จ!\nส่งรูปสลิปได้เลยครับ" },
  { from:"user", text:"📷 [รูปสลิป]" },
  { from:"bot",  card:true },
  { from:"bot",  text:"✅ บันทึกแล้ว · รอตรวจสอบ" },
  { from:"user", text:"/summary" },
  { from:"bot",  text:"📊 ยอดรวม: ฿142,380\nเอกสาร: 47 ใบ\nVAT: ฿9,307" },
]

function Bubble({ m }: { m: any }) {
  const isBot = m.from === "bot"
  const wrap  = `flex ${isBot ? "justify-start" : "justify-end"}`
  const cls   = "max-w-[85%] rounded-[11px] px-2.5 py-1.5 text-[11px] leading-snug whitespace-pre-line " +
    (isBot ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
           : "bg-[#06C755] text-white")

  if (m.card) return (
    <div className={wrap}>
      <div className="bg-white dark:bg-slate-800 rounded-[11px] overflow-hidden shadow-sm w-[175px]">
        <div className="bg-gradient-to-r from-brand-500 to-brand-700 px-2.5 py-1.5 flex items-center gap-1.5 text-white">
          <Zap className="w-3 h-3 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold truncate">7-Eleven ทองหล่อ 24</div>
            <div className="text-[8px] opacity-80">AI ดึงข้อมูล · 98%</div>
          </div>
        </div>
        <div className="px-2.5 py-1.5 space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-500">ยอดรวม</span>
            <span className="font-bold text-slate-900 dark:text-white">฿118.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">VAT</span>
            <span className="text-slate-600 dark:text-slate-300">฿7.71</span>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100 dark:border-slate-700 text-[9.5px] font-semibold">
          <button className="py-1.5 text-slate-400 border-r border-slate-100 dark:border-slate-700">แก้ไข</button>
          <button className="py-1.5 text-brand-500">อนุมัติ</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={wrap}>
      <div className={cls}>{m.text}</div>
    </div>
  )
}

export function StaticLineChatPreview() {
  return (
    <div className="rounded-[12px] border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-[#06C755] text-white px-3 py-2.5 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-white text-[#06C755] flex items-center justify-center font-black text-[12px] shrink-0">S</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[12px]">Slippy Bot</div>
          <div className="text-[9.5px] opacity-80 flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-white" /> ออนไลน์
          </div>
        </div>
        <MoreHorizontal className="w-3.5 h-3.5 opacity-60" />
      </div>

      {/* Messages — all shown at once, no animation */}
      <div className="bg-[#7EAFC9]/12 dark:bg-slate-900/40 px-2.5 py-3 space-y-2">
        {MSGS.map((m, i) => <Bubble key={i} m={m} />)}
      </div>

      {/* Input */}
      <div className="px-2.5 py-2 border-t border-border bg-card flex items-center gap-1.5">
        <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Plus className="w-3 h-3 text-muted-foreground" />
        </span>
        <div className="flex-1 h-6 rounded-full bg-muted px-2.5 text-[10.5px] text-muted-foreground flex items-center">
          พิมพ์ข้อความ...
        </div>
        <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Camera className="w-3 h-3 text-muted-foreground" />
        </span>
      </div>
    </div>
  )
}

// Keep animated version for backward compatibility
export { StaticLineChatPreview as LineChatPreview }
