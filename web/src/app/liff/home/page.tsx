/**
 * /liff/home — LINE-only login gate for the Rich Menu pillar cards
 *
 * Every "Slippy Universe" pillar card (❤️ Health · 🪙 Wealth · 🛍️ Lifestyle ·
 * 📊 Dashboard · 👥 Community · ...) routes through this LIFF page first via
 * `https://liff.line.me/{LIFF_ID}/liff/home?next=/personal/health`.
 *
 * Why a dedicated page instead of opening the destination directly:
 *   - The full web app's login is a desktop-oriented Supabase email/password
 *     form — clunky inside LINE's in-app browser on a phone.
 *   - Inside LIFF the user is ALREADY signed into LINE — we can mint a
 *     Slippy session from that in one tap, no typing required.
 *
 * Flow: liff.init() → liff.login() (if needed) → liff.getIDToken() →
 *       POST /api/auth/liff { idToken, next } → redirect to action_link
 *       → /auth/line-callback sets the Supabase session → lands on `next`.
 */

"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

type Status = "checking" | "needLogin" | "outsideLine" | "bridging" | "authError"

export default function LiffHomeGate() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/dashboard"

  const [status, setStatus]   = useState<Status>("checking")
  const [error, setError]     = useState("")
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => { void init() }, [])

  async function init() {
    setStatus("checking")
    setError("")

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      setStatus("authError")
      setError("ระบบยังไม่ได้ตั้งค่า LIFF (NEXT_PUBLIC_LIFF_ID ไม่พบ) — กรุณาติดต่อผู้ดูแลระบบ")
      return
    }

    let liff: any
    try {
      const mod = await import("@line/liff")
      liff = mod.default
      // also finishes processing any #liff.state=... redirect from liff.login()
      await liff.init({ liffId })
    } catch (err: any) {
      setStatus("authError")
      setError(`เริ่มต้น LIFF ไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
      return
    }

    if (!liff.isInClient()) {
      setStatus("outsideLine")
      return
    }

    if (!liff.isLoggedIn()) {
      setStatus("needLogin")
      return
    }

    await bridge(liff)
  }

  // Already logged into LINE (or just finished liff.login()) — exchange the
  // LIFF ID token for a Slippy session and land on the destination pillar.
  async function bridge(liff: any) {
    setStatus("bridging")
    try {
      const idToken = liff.getIDToken?.()
      if (!idToken) throw new Error("ไม่พบ ID token จาก LINE")

      const res  = await fetch("/api/auth/liff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, next }),
      })
      const data = await res.json()
      if (!res.ok || !data.actionLink) {
        throw new Error(data.detail ?? data.error ?? "เข้าสู่ระบบไม่สำเร็จ")
      }

      // Full navigation (not router.push) — the action_link is a Supabase
      // domain URL that redirects back to /auth/line-callback#access_token=...
      window.location.href = data.actionLink
    } catch (err: any) {
      setStatus("authError")
      setError(`เข้าสู่ระบบด้วย LINE ไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
    }
  }

  async function handleLineLogin() {
    setLoggingIn(true)
    try {
      const mod = await import("@line/liff")
      const liff = mod.default
      const redirectUri = window.location.href.split("#")[0]
      liff.login({ redirectUri })
    } catch (err: any) {
      setLoggingIn(false)
      setStatus("authError")
      setError(`เข้าสู่ระบบด้วย LINE ไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
    }
  }

  // ── Checking / bridging — full-bleed branded loader ─────────────────────
  if (status === "checking" || status === "bridging") {
    return (
      <Shell>
        <Loader2 className="w-7 h-7 animate-spin text-violet-600" />
        <p className="text-xs text-muted-foreground mt-3">
          {status === "bridging" ? "กำลังเข้าสู่ระบบด้วยบัญชี LINE..." : "กำลังเชื่อมต่อกับ LINE..."}
        </p>
      </Shell>
    )
  }

  // ── Opened outside the LINE app ──────────────────────────────────────────
  if (status === "outsideLine") {
    return (
      <Shell>
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg">📱</div>
          <p className="font-semibold mb-1">เปิดจากแอป LINE เท่านั้น</p>
          <p className="text-sm text-muted-foreground">แตะเมนูจากแชท Slippy ในแอป LINE เพื่อเข้าสู่ระบบและใช้งานหน้านี้</p>
        </div>
      </Shell>
    )
  }

  // ── Real error ────────────────────────────────────────────────────────────
  if (status === "authError") {
    return (
      <Shell>
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-2xl mx-auto mb-3">⚠️</div>
          <p className="font-semibold mb-1">เข้าสู่ระบบไม่สำเร็จ</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => void init()}
            className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </Shell>
    )
  }

  // ── LINE-only branded login (mobile-first — replaces the desktop web-login form) ──
  return (
    <Shell>
      <div className="text-center max-w-xs w-full">
        <div className="w-16 h-16 rounded-2xl bg-[#06C755] flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
          💬
        </div>
        <p className="font-bold text-lg mb-1">เข้าสู่ระบบด้วยบัญชี LINE</p>
        <p className="text-sm text-muted-foreground mb-6">
          Slippy ใช้บัญชี LINE ของคุณเพื่อเข้าสู่ระบบโดยตรง — ไม่ต้องสมัครสมาชิก
          ไม่ต้องตั้งรหัสผ่าน ปลอดภัยและรวดเร็วกว่าเดิม
        </p>
        <button
          onClick={handleLineLogin}
          disabled={loggingIn}
          className="w-full h-12 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-60 transition-colors"
        >
          {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-base">💬</span>}
          เข้าสู่ระบบด้วย LINE
        </button>
        <p className="text-xs text-muted-foreground mt-4">Powered by Slippy · AI Life Assistant</p>
      </div>
    </Shell>
  )
}

// Shared full-screen, mobile-centered shell — LINE-green-tinted brand gradient
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#06C755]/10 via-white to-violet-50 dark:from-[#06C755]/5 dark:via-slate-900 dark:to-slate-900">
      {children}
    </div>
  )
}
