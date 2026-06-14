/**
 * /liff/split — "หารบิล" Dashboard (LIFF mini-app, "à la KhunThong")
 *
 * Opens INSIDE LINE app — generic even-split bill (no document, no sport/trip
 * theme). Mirrors /liff/sport and /liff/trip (same auth flow, same even-split
 * mechanics via split_bills.category='general') with a minimal create-form:
 * title + total amount + optional note.
 *
 * Views: list → create → detail
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Loader2, AlertCircle, Plus, Users, ChevronLeft,
  CheckCircle2, Circle, Share2, Lock, ArrowRight,
} from "lucide-react"

type View = "list" | "create" | "detail"

interface GroupSummary {
  id: string; title: string; note: string | null
  fee: number; status: string; shareToken: string
  createdAt: string; paidCount: number; headCount: number
}
interface Participant { id: string; name: string; amount: number; paid: boolean; isMe: boolean }
interface GroupDetail {
  id: string; title: string; note: string | null
  fee: number; status: string; shareToken: string
  participants: Participant[]; paidTotal: number
}

function fmtTHB(n: number) {
  return "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type AuthStatus = "checking" | "needLogin" | "outsideLine" | "ready" | "authError"

export default function LiffSplitDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking")
  const [authError,  setAuthError]  = useState("")
  const [loggingIn,  setLoggingIn]  = useState(false)
  const [profile, setProfile] = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null)
  const [needsConnect, setNeedsConnect] = useState(false)
  const [error, setError]   = useState("")

  const [view, setView]     = useState<View>("list")
  const [groups, setGroups] = useState<GroupSummary[] | null>(null)
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [busy, setBusy]     = useState(false)

  // create-form state
  const [title, setTitle] = useState("")
  const [fee, setFee]     = useState("")
  const [note, setNote]   = useState("")

  // Set right after a new bill is created — shows the "เลือกกลุ่ม LINE เพื่อ
  // โพสต์คำเชิญ" prompt on the detail page.
  const [justCreated, setJustCreated] = useState(false)

  useEffect(() => { init() }, [])

  // Arriving from "/liff/places" via "🆕 สร้างกลุ่ม" on a place card — seed the
  // create form's title/note from the chosen place.
  useEffect(() => {
    if (searchParams.get("seedPlace") !== "1") return
    const raw = sessionStorage.getItem("slippy_place_group_seed")
    if (raw) {
      try {
        const place = JSON.parse(raw) as { name: string; address: string }
        setTitle(`หารบิลที่ ${place.name}`)
        setNote(place.address ?? "")
      } catch {}
      sessionStorage.removeItem("slippy_place_group_seed")
    }
    setView("create")
    router.replace("/liff/split")
  }, [searchParams, router])

  // LIFF auth — done step-by-step (same explicit flow as /liff/sport) so we can
  // show our OWN branded "เข้าสู่ระบบด้วย LINE" screen and surface real errors
  // instead of silently bouncing through LINE's bare OAuth page.
  async function init() {
    setAuthStatus("checking")
    setAuthError("")

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      setAuthStatus("authError")
      setAuthError("ระบบยังไม่ได้ตั้งค่า LIFF (NEXT_PUBLIC_LIFF_ID ไม่พบ) — กรุณาติดต่อผู้ดูแลระบบ")
      return
    }

    let liff: any
    try {
      const mod = await import("@line/liff")
      liff = mod.default
      // liff.init() also finishes processing any login redirect (#liff.state=...)
      // that brought us back here after tapping "เข้าสู่ระบบด้วย LINE" below.
      await liff.init({ liffId })
    } catch (err: any) {
      setAuthStatus("authError")
      setAuthError(`เริ่มต้น LIFF ไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
      return
    }

    if (!liff.isInClient()) {
      setAuthStatus("outsideLine")
      return
    }

    if (!liff.isLoggedIn()) {
      setAuthStatus("needLogin")
      return
    }

    try {
      const p = await liff.getProfile()
      const prof = { userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl }
      setProfile(prof)
      setAuthStatus("ready")
      await loadGroups(prof.userId)
    } catch (err: any) {
      setAuthStatus("authError")
      setAuthError(`ดึงข้อมูลโปรไฟล์ LINE ไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
    }
  }

  // User explicitly taps "เข้าสู่ระบบด้วย LINE" — runs liff.login(), which
  // redirects through LINE's consent screen and back to this exact URL
  // (stripped of any stale hash so liff.init() can re-process it cleanly).
  async function handleLineLogin() {
    setLoggingIn(true)
    try {
      const mod = await import("@line/liff")
      const liff = mod.default
      const redirectUri = window.location.href.split("#")[0]
      liff.login({ redirectUri })
    } catch (err: any) {
      setLoggingIn(false)
      setAuthStatus("authError")
      setAuthError(`เข้าสู่ระบบด้วย LINE ไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
    }
  }

  async function loadGroups(userId: string) {
    try {
      const res = await fetch(`/api/liff/split-groups?lineUserId=${userId}`)
      const data = await res.json()
      if (data.needsConnect) setNeedsConnect(true)
      setGroups(data.groups ?? [])
    } catch { setError("โหลดรายการบิลไม่สำเร็จ") }
  }

  async function openDetail(id: string, opts?: { justCreated?: boolean }) {
    if (!profile) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/split-groups/${id}?lineUserId=${profile.userId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ไม่พบบิล"); return }
      setDetail(data.group)
      setView("detail")
      setJustCreated(!!opts?.justCreated)
    } finally { setBusy(false) }
  }

  async function refreshDetail(id: string) {
    if (!profile) return
    const res = await fetch(`/api/liff/split-groups/${id}?lineUserId=${profile.userId}`)
    const data = await res.json()
    if (res.ok) setDetail(data.group)
  }

  async function doAction(action: "join" | "pay" | "unpay" | "finalize") {
    if (!profile || !detail) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/split-groups/${detail.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lineUserId: profile.userId, displayName: profile.displayName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ทำรายการไม่สำเร็จ"); return }
      setDetail(data.group)
      loadGroups(profile.userId)
    } finally { setBusy(false) }
  }

  async function createGroup() {
    if (!profile || !title.trim() || !fee) return
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/liff/split-groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId, displayName: profile.displayName,
          title: title.trim(), fee: Number(fee), note: note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsConnect) setNeedsConnect(true)
        setError(data.error ?? "สร้างบิลไม่สำเร็จ")
        return
      }
      setTitle(""); setFee(""); setNote("")
      await loadGroups(profile.userId)
      await openDetail(data.id, { justCreated: true })
    } finally { setBusy(false) }
  }

  // Builds the "การ์ดเชิญ" Flex Message — ชื่อบิล · หมายเหตุ · ค่าใช้จ่าย/หัว ·
  // ปุ่มเข้าร่วม — posted into whichever LINE chat the user picks below.
  function buildInviteFlex(d: GroupDetail) {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    const joinUrl = liffId
      ? `https://liff.line.me/${liffId}/liff/join/${d.shareToken}?type=split`
      : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://slippy.ai"}/split/join/${d.shareToken}`
    const perPerson = d.participants.find(p => p.isMe)?.amount ?? d.participants[0]?.amount ?? d.fee

    const rows: any[] = []
    if (d.note) {
      rows.push({ type: "box", layout: "baseline", spacing: "sm", contents: [
        { type: "text", text: "📝", flex: 0, size: "sm" },
        { type: "text", text: d.note, size: "sm", color: "#555555", margin: "md", wrap: true },
      ]})
    }
    rows.push({ type: "box", layout: "baseline", spacing: "sm", contents: [
      { type: "text", text: "💰", flex: 0, size: "sm" },
      { type: "text", text: `${fmtTHB(perPerson)} / คน  (รวม ${fmtTHB(d.fee)})`, size: "sm", color: "#555555", margin: "md", wrap: true },
    ]})

    return {
      type: "flex",
      altText: `🧾 ชวนหารบิล ${d.title} — ${fmtTHB(perPerson)}/คน`,
      contents: {
        type: "bubble",
        body: {
          type: "box", layout: "vertical", spacing: "md",
          contents: [
            { type: "text", text: `🧾 ${d.title}`, weight: "bold", size: "lg", wrap: true },
            { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: rows },
          ],
        },
        footer: {
          type: "box", layout: "vertical", spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#e11d48", height: "sm",
              action: { type: "uri", label: "🙋 เข้าร่วม / ดูรายละเอียด", uri: joinUrl } },
          ],
        },
      },
    }
  }

  // เลือกกลุ่ม LINE ที่จะโพสต์คำเชิญ → bot โพสการ์ดเชิญลงในกลุ่มที่เลือก
  async function shareInviteCard() {
    if (!detail) return
    try {
      const mod = await import("@line/liff")
      const liff = mod.default
      if (liff.isApiAvailable?.("shareTargetPicker")) {
        await liff.shareTargetPicker([buildInviteFlex(detail) as any])
        setJustCreated(false)
        return
      }
    } catch { /* fall through to clipboard */ }
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    const url = liffId
      ? `https://liff.line.me/${liffId}/liff/join/${detail.shareToken}?type=split`
      : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://slippy.ai"}/split/join/${detail.shareToken}`
    try { await navigator.clipboard.writeText(url) } catch {}
    setJustCreated(false)
  }

  // ───────────────────────────────────────────────────────── render helpers

  function Header({ title, onBack }: { title: string; onBack?: () => void }) {
    return (
      <div className="flex items-center gap-2 mb-4">
        {onBack && (
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-lg font-bold flex-1">{title}</h1>
      </div>
    )
  }

  // ── Checking LIFF state ──────────────────────────────────────────────────
  if (authStatus === "checking") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="w-7 h-7 animate-spin text-rose-600" />
        <p className="text-xs text-muted-foreground">กำลังเชื่อมต่อกับ LINE...</p>
      </div>
    )
  }

  // ── Opened outside the LINE app (external browser) ───────────────────────
  if (authStatus === "outsideLine") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg">🧾</div>
          <p className="font-semibold mb-1">เปิดจากแอป LINE เท่านั้น</p>
          <p className="text-sm text-muted-foreground">แตะเมนู "หารบิล" จากแชท Slippy ในแอป LINE เพื่อเข้าใช้งานแดชบอร์ดนี้</p>
        </div>
      </div>
    )
  }

  // ── LINE-branded login screen (only shown for LIFF — never the Slippy web login) ──
  if (authStatus === "needLogin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#06C755]/10 via-white to-rose-50 dark:from-[#06C755]/5 dark:via-slate-900 dark:to-slate-900">
        <div className="text-center max-w-xs w-full">
          <div className="w-16 h-16 rounded-2xl bg-[#06C755] flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
            💬
          </div>
          <p className="font-bold text-lg mb-1">เข้าสู่ระบบด้วยบัญชี LINE</p>
          <p className="text-sm text-muted-foreground mb-6">
            🧾 หารบิล Slippy ใช้บัญชี LINE ของคุณเพื่อระบุตัวตน — ไม่ต้องสมัครสมาชิกใหม่
            หรือใช้รหัสผ่านใดๆ ทั้งสิ้น
          </p>
          <button
            onClick={handleLineLogin}
            disabled={loggingIn}
            className="w-full h-12 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-60 transition-colors"
          >
            {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-base">💬</span>}
            เข้าสู่ระบบด้วย LINE
          </button>
          <p className="text-xs text-muted-foreground mt-4">
            Powered by Slippy · AI Life Assistant
          </p>
        </div>
      </div>
    )
  }

  // ── Real error from the LIFF SDK (init / login / getProfile) ─────────────
  if (authStatus === "authError") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <p className="font-semibold mb-1">เชื่อมต่อกับ LINE ไม่สำเร็จ</p>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mb-4 break-words">{authError}</p>
          <button onClick={init} className="text-sm text-brand-500 hover:underline font-medium">↻ ลองเชื่อมต่อใหม่</button>
        </div>
      </div>
    )
  }

  if (!profile) return null // unreachable — authStatus === "ready" implies profile is set

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 dark:from-slate-900 dark:to-slate-800 p-4 pb-10">
      <div className="max-w-md mx-auto">

        {error && (
          <div className="mb-3 flex items-start gap-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="font-bold">×</button>
          </div>
        )}

        {/* ───────────── LIST VIEW ───────────── */}
        {view === "list" && (
          <>
            <div className="flex items-center gap-3 mb-5">
              {profile.pictureUrl && <img src={profile.pictureUrl} className="w-10 h-10 rounded-full border-2 border-white shadow" alt="" />}
              <div>
                <p className="text-xs text-muted-foreground">สวัสดี 👋</p>
                <p className="font-bold">{profile.displayName}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold flex items-center gap-1.5">🧾 หารบิลของฉัน</h1>
              <button
                onClick={() => { setView("create"); setError("") }}
                className="h-9 px-3.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white text-sm font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" /> สร้างบิล
              </button>
            </div>

            {needsConnect && (
              <div className="mb-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <p>💡 ยังไม่ได้เชื่อมบัญชี — เชื่อมก่อนเพื่อสร้าง/จัดการบิลได้เต็มรูปแบบ (ดูยังได้ตามปกติ)</p>
                <a
                  href="/api/auth/line?next=/liff/split"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#06C755] text-white text-xs font-semibold active:scale-95 transition-transform"
                >
                  เข้าสู่ระบบด้วย LINE (เชื่อมอัตโนมัติ)
                </a>
                <p className="text-amber-700/80 dark:text-amber-300/70">หรือพิมพ์ <b>/connect CODE</b> ในแชท Slippy</p>
              </div>
            )}

            {groups === null && (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-rose-500" /></div>
            )}

            {groups?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">🧾</p>
                <p className="font-semibold">ยังไม่มีบิลที่หาร</p>
                <p className="text-sm text-muted-foreground mt-1">กดปุ่ม "สร้างบิล" เพื่อเริ่มหารค่าใช้จ่ายแรกของคุณ</p>
              </div>
            )}

            <div className="space-y-2.5">
              {groups?.map(g => (
                <button
                  key={g.id}
                  onClick={() => openDetail(g.id)}
                  className="w-full text-left bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-500/20 dark:to-orange-500/20 flex items-center justify-center text-2xl shrink-0">
                    🧾
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold truncate">{g.title}</p>
                      {g.status === "finalized" && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> ปิดแล้ว
                        </span>
                      )}
                    </div>
                    {g.note && <p className="text-xs text-muted-foreground truncate mt-0.5">{g.note}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">{fmtTHB(g.fee)}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{g.headCount} คน</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{g.paidCount}/{g.headCount} จ่ายแล้ว</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* ───────────── CREATE VIEW ───────────── */}
        {view === "create" && (
          <>
            <Header title="สร้างบิลหารใหม่" onBack={() => setView("list")} />
            <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">ชื่อบิล</p>
                <input
                  value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="เช่น ค่าข้าวเย็น, ค่าหอพักเดือนนี้"
                  autoFocus
                  className="w-full h-11 rounded-xl border px-3 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">ยอดรวม (บาท)</p>
                <input
                  type="number" inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)}
                  placeholder="เช่น 1200"
                  className="w-full h-11 rounded-xl border px-3 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">หมายเหตุ (ไม่บังคับ)</p>
                <input
                  value={note} onChange={e => setNote(e.target.value)}
                  placeholder="เช่น ร้านอาหารญี่ปุ่น"
                  className="w-full h-11 rounded-xl border px-3 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                />
              </div>

              <button
                onClick={createGroup}
                disabled={!title.trim() || !fee || Number(fee) <= 0 || busy}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "สร้างบิล →"}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                💡 ระบบจะหารยอดเท่าๆ กันให้อัตโนมัติเมื่อเพื่อนเข้าร่วม
              </p>
            </div>
          </>
        )}

        {/* ───────────── DETAIL VIEW ───────────── */}
        {view === "detail" && detail && (
          <>
            <Header title={`🧾 ${detail.title}`} onBack={() => { setView("list"); setDetail(null); setJustCreated(false) }} />

            {/* เลือกกลุ่ม LINE ที่จะโพสต์คำเชิญ — shown once right after a new
                bill is created; the chosen chat receives the invite Flex card. */}
            {justCreated && (
              <div className="mb-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                <span className="text-2xl shrink-0">🎉</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-800">สร้างบิลสำเร็จ!</p>
                  <p className="text-xs text-amber-700 mt-0.5">เลือกกลุ่ม LINE เพื่อโพสต์การ์ดเชิญให้เพื่อน</p>
                </div>
                <button onClick={shareInviteCard} disabled={busy}
                  className="h-9 px-3.5 rounded-xl bg-amber-500 text-white text-xs font-semibold shrink-0 active:scale-95 transition-transform disabled:opacity-50">
                  เลือกกลุ่ม
                </button>
              </div>
            )}

            <div className="bg-gradient-to-r from-rose-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg mb-3">
              {detail.note && <p className="text-sm text-white/80 mb-1">{detail.note}</p>}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-white/70">ยอดรวม</p>
                  <p className="text-2xl font-black">{fmtTHB(detail.fee)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/70">ต่อคน</p>
                  <p className="text-lg font-bold">{fmtTHB(detail.participants[0]?.amount ?? detail.fee)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-white/80">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{detail.participants.length} คน</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{fmtTHB(detail.paidTotal)} จ่ายแล้ว</span>
                {detail.status === "finalized" && (
                  <span className="ml-auto flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5"><Lock className="w-3 h-3" />ปิดบิลแล้ว</span>
                )}
              </div>
            </div>

            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm mb-3">
              <p className="text-xs font-semibold text-muted-foreground px-4 pt-3 pb-1">รายชื่อ ({detail.participants.length})</p>
              {detail.participants.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-t first:border-t-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.paid ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                    <span className={cn("text-sm truncate", p.isMe && "font-bold")}>{p.name}{p.isMe && " (คุณ)"}</span>
                  </div>
                  <span className={cn("text-sm font-semibold shrink-0", p.paid ? "text-emerald-600" : "text-muted-foreground")}>{fmtTHB(p.amount)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {detail.status !== "finalized" && (
                <>
                  {detail.participants.find(p => p.isMe) ? (
                    <button
                      onClick={() => doAction(detail.participants.find(p => p.isMe)?.paid ? "unpay" : "pay")}
                      disabled={busy}
                      className={cn(
                        "w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50",
                        detail.participants.find(p => p.isMe)?.paid
                          ? "bg-muted text-foreground border"
                          : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                      )}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : detail.participants.find(p => p.isMe)?.paid ? "↺ ยกเลิกการจ่าย" : "✅ จ่ายแล้ว — กดยืนยัน"}
                    </button>
                  ) : (
                    <button
                      onClick={() => doAction("join")}
                      disabled={busy}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "🙋 เข้าร่วมบิลนี้"}
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={shareInviteCard} className="h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                      <Share2 className="w-4 h-4" /> ส่งการ์ดเชิญ
                    </button>
                    <button
                      onClick={() => doAction("finalize")}
                      disabled={busy}
                      className="h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5 text-rose-600 border-rose-200 dark:border-rose-500/30 active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <Lock className="w-4 h-4" /> ปิดบิล / สรุปยอด
                    </button>
                  </div>
                </>
              )}
              {detail.status === "finalized" && (
                <button onClick={shareInviteCard} className="w-full h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5">
                  <Share2 className="w-4 h-4" /> แชร์สรุปยอด
                </button>
              )}
              <button onClick={() => refreshDetail(detail.id)} className="w-full text-xs text-muted-foreground py-1">
                ↻ รีเฟรชสถานะ
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
