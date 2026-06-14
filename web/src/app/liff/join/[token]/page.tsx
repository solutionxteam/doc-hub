/**
 * /liff/join/[token] — LIFF Join Page
 *
 * Opens INSIDE LINE app.
 * LINE automatically provides userId + displayName.
 * No /connect required for bill participants.
 */

"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Loader2, CheckCircle, AlertCircle, Users, MapPin } from "lucide-react"

type JoinStatus = "loading" | "identifying" | "joining" | "success" | "error" | "not_found" | "closed"

interface BillInfo {
  id:     string
  title:  string
  type:   string
  venue:  string | null
  host:   string
  participants: number
  total:  number
  registrationClosed?: boolean
}

export default function LiffJoinPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const token        = params.token as string
  const type         = searchParams.get("type") ?? "trip"   // trip | split

  const [status,   setStatus]   = useState<JoinStatus>("loading")
  const [billInfo, setBillInfo] = useState<BillInfo | null>(null)
  const [profile,  setProfile]  = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null)
  const [error,    setError]    = useState("")
  const [name,     setName]     = useState("")  // fallback if not in LINE

  useEffect(() => { init() }, [token])

  async function init() {
    setStatus("loading")

    // Load bill info first (works without LIFF)
    try {
      const res  = await fetch(`/api/liff/bill-info?token=${token}&type=${type}`)
      const data = await res.json()
      if (!res.ok || !data.bill) { setStatus("not_found"); return }
      setBillInfo(data.bill)
      if (data.bill.registrationClosed) { setStatus("closed"); return }
    } catch { setStatus("not_found"); return }

    // Try LIFF (auto-identify if inside LINE app)
    setStatus("identifying")
    try {
      const { initLiff, getLiffProfile, isInLineApp } = await import("@/lib/liff")
      const ok = await initLiff()

      if (ok && isInLineApp()) {
        const p = await getLiffProfile()
        if (p) {
          setProfile(p)
          setName(p.displayName)
          // Auto-join if we have profile
          await joinBill(p.userId, p.displayName, p.pictureUrl)
          return
        }
      }
    } catch { /* LIFF not available — fall through to manual */ }

    // Fallback: ask for name (web browser or LIFF ID not configured)
    setStatus("joining")
  }

  async function joinBill(lineUserId: string, displayName: string, pictureUrl?: string) {
    setStatus("joining")
    try {
      const endpoint = type === "trip" ? "/api/liff/join-trip" : "/api/liff/join-split"
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, lineUserId, displayName, pictureUrl }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "ไม่สามารถเข้าร่วมได้"); setStatus("error"); return }
      setStatus("success")
    } catch { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); setStatus("error") }
  }

  async function handleManualJoin() {
    if (!name.trim()) return
    await joinBill(`guest_${Date.now()}`, name.trim())
  }

  const EMOJI: Record<string, string> = { travel:"✈️", food_order:"🍽️", sport:"🏸", general:"💰", split:"🧾" }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-5">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-3xl mx-auto mb-2 shadow-lg">
            👻
          </div>
          <p className="text-sm text-muted-foreground font-medium">Slippy · หารค่าใช้จ่าย</p>
        </div>

        {/* Card */}
        <div className="bg-card border rounded-2xl shadow-xl overflow-hidden">

          {/* Bill info header */}
          {billInfo && (
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-white">
              <p className="text-xl font-black">{EMOJI[billInfo.type] ?? "💰"} {billInfo.title}</p>
              {billInfo.venue && <p className="text-sm text-white/80 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{billInfo.venue}</p>}
              <div className="flex items-center gap-3 mt-2 text-sm text-white/70">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{billInfo.participants} คน</span>
                <span>โดย {billInfo.host}</span>
              </div>
            </div>
          )}

          <div className="p-5">

            {/* Loading */}
            {(status === "loading" || status === "identifying") && (
              <div className="flex flex-col items-center py-6 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                <p className="text-sm text-muted-foreground">
                  {status === "identifying" ? "กำลังระบุตัวตน..." : "กำลังโหลด..."}
                </p>
              </div>
            )}

            {/* Manual name input (fallback) */}
            {status === "joining" && !profile && (
              <div className="space-y-4">
                <p className="text-sm font-medium">ใส่ชื่อเพื่อเข้าร่วม</p>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleManualJoin()}
                  placeholder="ชื่อ-นามสกุล หรือชื่อเล่น"
                  autoFocus
                  className="w-full h-11 rounded-xl border px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                />
                <button
                  onClick={handleManualJoin}
                  disabled={!name.trim()}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
                >
                  เข้าร่วมเลย →
                </button>
              </div>
            )}

            {/* LINE identified — auto-joining */}
            {status === "joining" && profile && (
              <div className="flex flex-col items-center py-6 gap-3">
                {profile.pictureUrl && (
                  <img src={profile.pictureUrl} alt={profile.displayName}
                    className="w-14 h-14 rounded-full border-2 border-brand-500" />
                )}
                <p className="font-semibold">{profile.displayName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังเข้าร่วม...
                </div>
              </div>
            )}

            {/* Success */}
            {status === "success" && (
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-lg">เข้าร่วมแล้ว! 🎉</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {profile ? `ยินดีต้อนรับ ${profile.displayName}` : `ยินดีต้อนรับ ${name}`}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  💡 เพิ่ม Slippy เป็นเพื่อนใน LINE เพื่อรับการแจ้งเตือนเมื่อมีการอัปเดตบิล
                </p>
                <a
                  href={`https://line.me/R/ti/p/@${process.env.NEXT_PUBLIC_LINE_BOT_ID ?? ""}`}
                  className="w-full h-11 rounded-xl bg-[#06C755] text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <span className="text-base">💬</span> เพิ่ม Slippy เป็นเพื่อน
                </a>
              </div>
            )}

            {/* Not found */}
            {status === "not_found" && (
              <div className="flex flex-col items-center py-6 gap-2 text-center">
                <AlertCircle className="w-10 h-10 text-amber-500" />
                <p className="font-semibold">ไม่พบบิลนี้</p>
                <p className="text-sm text-muted-foreground">ลิงก์อาจหมดอายุหรือถูกลบแล้ว</p>
              </div>
            )}

            {/* Registration closed */}
            {status === "closed" && (
              <div className="flex flex-col items-center py-6 gap-2 text-center">
                <AlertCircle className="w-10 h-10 text-amber-500" />
                <p className="font-semibold">⏰ เกินกำหนดการลงทะเบียนแล้ว</p>
                <p className="text-sm text-muted-foreground">เซสชันนี้ปิดรับลงทะเบียนแล้ว — ติดต่อผู้จัดกลุ่มถ้าต้องการเข้าร่วมเพิ่ม</p>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="flex flex-col items-center py-4 gap-3 text-center">
                <AlertCircle className="w-10 h-10 text-rose-500" />
                <p className="font-semibold">เกิดข้อผิดพลาด</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <button onClick={init} className="text-sm text-brand-500 hover:underline">ลองใหม่</button>
              </div>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by Slippy · AI Life Assistant
        </p>
      </div>
    </div>
  )
}
