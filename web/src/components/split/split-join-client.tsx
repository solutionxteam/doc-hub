"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface LineItem { id: string; description: string; amount: number }
interface Claim    { line_item_id: string; claimer_name: string; claimer_line_id?: string; participant_id?: string }
interface Participant { id: string; name: string; line_user_id?: string; amount: number }
interface Bill {
  id: string; title: string; total_amount: number; vat_amount: number
  status: string; participants: Participant[]
}

function fmtTHB(n: number) {
  return "฿" + Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })
}

export function SplitJoinClient({ bill, lineItems, claims: initialClaims, token }: {
  bill:      Bill
  lineItems: LineItem[]
  claims:    Claim[]
  token:     string
}) {
  const [name,    setName]    = useState("")
  const [joined,  setJoined]  = useState(false)
  const [claims,  setClaims]  = useState<Claim[]>(initialClaims)
  const [loading, setLoading] = useState(false)

  const vatRate  = bill.total_amount > 0 ? bill.vat_amount / bill.total_amount : 0
  const claimMap = new Map(claims.map(c => [c.line_item_id, c.claimer_name]))
  const myItems  = claims.filter(c => c.claimer_name === name)
  const myTotal  = myItems.reduce((s, c) => {
    const item = lineItems.find(i => i.id === c.line_item_id)
    return s + (item?.amount ?? 0)
  }, 0)
  const myVat    = myTotal * vatRate

  const handleJoin = () => {
    if (!name.trim()) { toast.error("กรุณากรอกชื่อก่อน"); return }
    setJoined(true)
  }

  const handleClaim = async (itemId: string, isAlreadyMine: boolean) => {
    if (!joined || loading) return
    if (isAlreadyMine) {
      // Unclaim
      setLoading(true)
      const res = await fetch(`/api/split/${bill.id}/claim`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId: itemId, claimerName: name }),
      })
      if (res.ok) setClaims(prev => prev.filter(c => c.line_item_id !== itemId))
      setLoading(false)
      return
    }
    const existing = claimMap.get(itemId)
    if (existing && existing !== name) {
      toast.error(`${existing} เลือกรายการนี้แล้ว`)
      return
    }
    setLoading(true)
    const res = await fetch(`/api/split/${bill.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItemId: itemId, claimerName: name, isNonLine: true }),
    })
    if (res.ok) {
      setClaims(prev => [...prev.filter(c => c.line_item_id !== itemId),
        { line_item_id: itemId, claimer_name: name }])
      toast.success("เลือกรายการแล้ว!")
    } else {
      toast.error("เกิดข้อผิดพลาด")
    }
    setLoading(false)
  }

  if (bill.status === "finalized") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-xl font-bold">บิลปิดแล้ว</h1>
          <p className="text-muted-foreground">"{bill.title}" — ปิดการหารบิลแล้วครับ</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-md mx-auto space-y-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">หารบิล</p>
          <h1 className="text-xl font-bold mt-1">{bill.title}</h1>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black">{fmtTHB(bill.total_amount)}</span>
            {bill.vat_amount > 0 && (
              <span className="text-white/60 text-sm">รวม VAT {fmtTHB(bill.vat_amount)}</span>
            )}
          </div>
          <p className="text-white/60 text-xs mt-1">{lineItems.length} รายการ · {bill.participants.length} คน</p>
        </div>

        {/* Name input */}
        {!joined ? (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold">ชื่อของคุณ</h2>
            <p className="text-sm text-muted-foreground">กรอกชื่อเพื่อเลือกรายการที่คุณต้องจ่าย</p>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder="ชื่อ-นามสกุล หรือชื่อเล่น"
              className="w-full h-11 rounded-xl border border-border bg-muted px-3 text-sm
                outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15"
              autoFocus
            />
            <button onClick={handleJoin}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600
                text-white font-semibold text-sm transition-all hover:opacity-90">
              เข้าร่วมหารบิล →
            </button>
          </div>
        ) : (
          <>
            {/* My summary */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">เลือก {myItems.length} รายการ</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-brand-600">{fmtTHB(myTotal + myVat)}</p>
                  {myVat > 0 && <p className="text-xs text-muted-foreground">รวม VAT {fmtTHB(myVat)}</p>}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-sm">เลือกรายการที่คุณต้องจ่าย</h2>
                <p className="text-xs text-muted-foreground mt-0.5">แตะรายการเพื่อเลือก/ยกเลิก</p>
              </div>
              <div className="divide-y divide-border">
                {lineItems.map(item => {
                  const claimer   = claimMap.get(item.id)
                  const isMyItem  = claimer === name
                  const isTaken   = !!claimer && !isMyItem
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleClaim(item.id, isMyItem)}
                      disabled={loading || isTaken}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors",
                        isMyItem && "bg-brand-50 dark:bg-brand-500/10",
                        isTaken  && "opacity-60 cursor-not-allowed bg-muted/30",
                        !claimer  && "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                          isMyItem ? "border-brand-500 bg-brand-500" : "border-border"
                        )}>
                          {isMyItem && <span className="text-white text-[10px] font-black">✓</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.description || "รายการ"}</p>
                          {claimer && !isMyItem && (
                            <p className="text-xs text-muted-foreground">{claimer} เลือกแล้ว</p>
                          )}
                        </div>
                      </div>
                      <span className={cn("text-sm font-bold shrink-0 ml-3", isMyItem ? "text-brand-600" : "text-foreground")}>
                        {fmtTHB(item.amount)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Participants */}
            {bill.participants.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">คนที่เข้าร่วม</h3>
                {bill.participants.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500
                        flex items-center justify-center text-white text-[11px] font-bold">
                        {p.name.slice(0,1).toUpperCase()}
                      </div>
                      <span className="text-sm">{p.name}</span>
                      {p.line_user_id && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">LINE</span>}
                    </div>
                    {p.amount > 0 && <span className="text-sm font-semibold text-brand-600">{fmtTHB(p.amount)}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
