/**
 * /liff/sport — Sport Groups Dashboard (LIFF mini-app, "à la KhunThong")
 *
 * Opens INSIDE LINE app from the Rich Menu "🏸 กลุ่มกีฬา" tap-area.
 * LIFF auto-identifies the user (no /connect prompt needed for browsing —
 * but creating a group still requires a linked account, same as chat /sportgroup).
 *
 * Views: list → create → group-detail (recurring schedule + sessions) → session-detail
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Loader2, AlertCircle, Plus, MapPin, Users, ChevronLeft,
  CheckCircle2, Circle, Share2, Share, Link2, Lock, ArrowRight, Calendar, Clock, UserPlus,
  Navigation, Star, Pencil, Check, X, Camera, Trash2, RefreshCw,
} from "lucide-react"

type View = "list" | "create" | "group-detail" | "session-detail"

interface RecurringGroupSummary {
  id: string; title: string; emoji: string; sportType: string | null
  recurringDays: number[]; defaultStartTime: string | null; defaultEndTime: string | null
  defaultVenue: string | null; defaultCourtNo: string | null; maxPlayers: number | null
  status: string; shareToken: string
  upcomingSessionCount: number; nextSessionDate: string | null
}
interface LegacySessionSummary {
  id: string; title: string; emoji: string; sportType: string | null
  venue: string | null; fee: number; status: string; shareToken: string
  createdAt: string; paidCount: number; headCount: number
  bookingDate: string | null; startTime: string | null; endTime: string | null
  courtNo: string | null; mapUrl: string | null; maxPlayers: number | null
}
interface SessionSummary {
  id: string; title: string; emoji: string; sportType: string | null
  venue: string | null; fee: number; status: string; shareToken: string
  bookingDate: string | null; startTime: string | null; endTime: string | null
  courtNo: string | null; mapUrl: string | null; maxPlayers: number | null
  paidCount: number; headCount: number; isMember: boolean
}
interface GroupDetailData {
  id: string; title: string; emoji: string; sportType: string | null
  recurringDays: number[]; defaultStartTime: string | null; defaultEndTime: string | null
  defaultVenue: string | null; defaultCourtNo: string | null; defaultMapUrl: string | null
  maxPlayers: number | null; status: string; shareToken: string
  lineGroupId: string | null
}
interface Participant {
  id: string; name: string; amount: number; paid: boolean; isMe: boolean
  guestCount: number; paymentProofUrl: string | null
}
interface Expense { id: string; category: string; label: string | null; amount: number }
interface SessionDetail {
  id: string; title: string; emoji: string; sportType: string | null
  venue: string | null; fee: number; status: string; shareToken: string
  participants: Participant[]; paidTotal: number
  bookingDate: string | null; startTime: string | null; endTime: string | null
  courtNo: string | null; mapUrl: string | null; maxPlayers: number | null
  sportGroupId: string | null; groupTitle: string | null
  lineGroupId: string | null
  expenses: Expense[]; expensesTotal: number
}

const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"]
const THAI_MONTHS   = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]

const EXPENSE_CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "court",       label: "ค่าเล่น/ค่าคอร์ด", emoji: "🏸" },
  { value: "shuttlecock", label: "ค่าลูกแบด",        emoji: "🪶" },
  { value: "drinks",      label: "ค่าเครื่องดื่ม",     emoji: "🥤" },
  { value: "snacks",      label: "ค่าขนม",            emoji: "🍿" },
  { value: "other",       label: "อื่นๆ",              emoji: "💸" },
]

function expenseCategoryInfo(category: string) {
  return EXPENSE_CATEGORIES.find(c => c.value === category) ?? { value: category, label: category, emoji: "💸" }
}

/** [1,3,5] → "ทุกวันจันทร์, พุธ, ศุกร์" */
function recurringDaysLabel(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return "ไม่มีกำหนดประจำ"
  return `ทุกวัน${days.map(d => DAY_LABELS[d]).join(", ")}`
}

/** "2026-06-10" → "พุธที่ 10 มิ.ย." */
function thaiDateLabel(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T00:00:00")
  if (isNaN(d.getTime())) return ""
  return `${THAI_WEEKDAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`
}

/** "20:00" + "22:00" → "20:00 - 22:00 น." */
function timeRangeLabel(start: string | null, end: string | null): string {
  const s = start?.slice(0, 5)
  const e = end?.slice(0, 5)
  if (s && e) return `${s} - ${e} น.`
  if (s) return `${s} น.`
  return ""
}

// A session's registration window closes at its end time (or start time if no
// end time) on the booking date. Sessions with no booking date never close.
function isRegistrationClosed(d: { bookingDate: string | null; startTime: string | null; endTime: string | null }): boolean {
  if (!d.bookingDate) return false
  const deadline = new Date(`${d.bookingDate}T${d.endTime ?? d.startTime ?? "23:59"}:00`)
  return Date.now() > deadline.getTime()
}

const SPORT_OPTIONS = [
  { label: "แบดมินตัน", emoji: "🏸" },
  { label: "ฟุตบอล",    emoji: "⚽" },
  { label: "บาสเกตบอล", emoji: "🏀" },
  { label: "เทนนิส",    emoji: "🎾" },
  { label: "วอลเลย์บอล", emoji: "🏐" },
  { label: "ปิงปอง",    emoji: "🏓" },
]

function fmtTHB(n: number) {
  return "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type AuthStatus = "checking" | "needLogin" | "outsideLine" | "ready" | "authError"

export default function LiffSportDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking")
  const [authError,  setAuthError]  = useState("")
  const [loggingIn,  setLoggingIn]  = useState(false)
  const [profile, setProfile] = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null)
  // Set if this LIFF page was opened from inside a LINE group/room chat —
  // lets the create form offer "ตั้งกลุ่มแชทนี้เป็นกลุ่มหลัก" for notifications.
  const [liffGroupId, setLiffGroupId] = useState<string | null>(null)
  const [needsConnect, setNeedsConnect] = useState(false)
  const [error, setError]   = useState("")
  const [notice, setNotice] = useState("")

  const [view, setView] = useState<View>("list")
  const [groups, setGroups] = useState<RecurringGroupSummary[] | null>(null)
  const [legacySessions, setLegacySessions] = useState<LegacySessionSummary[] | null>(null)
  const [groupDetail, setGroupDetail] = useState<GroupDetailData | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [busy, setBusy] = useState(false)

  // create-form state
  const [sportType, setSportType] = useState("")
  const [venue, setVenue] = useState("")
  const [recurringDays, setRecurringDays] = useState<number[]>([])
  const [startTime, setStartTime]     = useState("")
  const [endTime, setEndTime]         = useState("")
  const [courtNo, setCourtNo]         = useState("")
  const [mapUrl, setMapUrl]           = useState("")
  const [maxPlayers, setMaxPlayers]   = useState("")
  // Whether to link this group's notifications to the LINE chat it was created from
  const [useLineGroupDefault, setUseLineGroupDefault] = useState(true)
  // Panel showing the "/linkgroup <code>" command to link a LINE group as the main chat
  const [linkGroupPanel, setLinkGroupPanel] = useState<{ label: string } | null>(null)

  // "เลือกสนาม" picker — null shows the 3-way chooser, otherwise the panel for that mode
  const [venueMode, setVenueMode] = useState<"near" | "favorite" | "manual" | null>(null)
  const [favoriteVenues, setFavoriteVenues] = useState<{ venue: string; courtNo: string | null; mapUrl: string | null }[] | null>(null)

  // "+1" guest editor on the session-detail page
  const [guestDraft, setGuestDraft] = useState<number | null>(null)

  // expense add-form state on the session-detail page
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0].value)
  const [expenseLabel, setExpenseLabel]       = useState("")
  const [expenseAmount, setExpenseAmount]     = useState("")
  const [proofBusy, setProofBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Set right after a new group is created — shows the "เลือกกลุ่ม LINE
  // เพื่อโพสต์คำเชิญ" prompt on the session-detail page (cleared once the user
  // shares or navigates away).
  const [justCreated, setJustCreated] = useState(false)

  useEffect(() => { init() }, [])

  // Returning from "/liff/places?picker=sport" with a chosen venue —
  // restore the create form and fill in the selected place.
  useEffect(() => {
    if (searchParams.get("restoreCreate") !== "1") return
    const draftRaw = sessionStorage.getItem("slippy_sport_create_draft")
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw) as {
          sportType: string; recurringDays: number[]; startTime: string
          endTime: string; courtNo: string; maxPlayers: string
        }
        setSportType(draft.sportType)
        setRecurringDays(draft.recurringDays)
        setStartTime(draft.startTime)
        setEndTime(draft.endTime)
        setCourtNo(draft.courtNo)
        setMaxPlayers(draft.maxPlayers)
      } catch {}
      sessionStorage.removeItem("slippy_sport_create_draft")
    }
    const raw = sessionStorage.getItem("slippy_place_picker_result")
    if (raw) {
      try {
        const place = JSON.parse(raw) as { name: string; address: string; mapsUrl: string }
        setVenue(place.name)
        setMapUrl(place.mapsUrl)
      } catch {}
      sessionStorage.removeItem("slippy_place_picker_result")
    }
    setView("create")
    setVenueMode(null)
    router.replace("/liff/sport")
  }, [searchParams, router])

  async function loadFavoriteVenues(userId: string) {
    try {
      const res = await fetch(`/api/liff/sport-groups/venues?lineUserId=${userId}`)
      const data = await res.json()
      setFavoriteVenues(data.venues ?? [])
    } catch { setFavoriteVenues([]) }
  }

  // LIFF auth — done step-by-step (instead of the auto-redirecting getLiffProfile())
  // so we can show our OWN branded "เข้าสู่ระบบด้วย LINE" screen rather than
  // silently bouncing the user to LINE's bare OAuth page (confusing — looks
  // like it might be Slippy's web login). This also lets us surface the *real*
  // error message if liff.init()/login()/getProfile() throws, instead of a
  // generic "เปิดจากแอป LINE เท่านั้น" that hides what actually went wrong.
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
      const ctx = liff.getContext?.()
      if (ctx?.type === "group" || ctx?.type === "room") {
        setLiffGroupId(ctx.groupId ?? ctx.roomId ?? null)
      }
    } catch {}

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
      const res = await fetch(`/api/liff/sport-groups?lineUserId=${userId}`)
      const data = await res.json()
      if (data.needsConnect) setNeedsConnect(true)
      setGroups(data.groups ?? [])
      setLegacySessions(data.legacySessions ?? [])
    } catch { setError("โหลดรายการกลุ่มไม่สำเร็จ") }
  }

  async function deleteGroup(groupId: string) {
    if (!profile) return
    if (!confirm("ลบกลุ่มนี้ออกจากรายการ?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups?groupId=${groupId}&lineUserId=${profile.userId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ลบกลุ่มไม่สำเร็จ"); return }
      await loadGroups(profile.userId)
    } finally { setBusy(false) }
  }

  async function deleteLegacySession(sessionId: string) {
    if (!profile) return
    if (!confirm("ลบเซสชันนี้ออกจากรายการ?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/sessions/${sessionId}?lineUserId=${profile.userId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ลบเซสชันไม่สำเร็จ"); return }
      await loadGroups(profile.userId)
    } finally { setBusy(false) }
  }

  async function openGroupDetail(groupId: string) {
    if (!profile) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/${groupId}/sessions?lineUserId=${profile.userId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ไม่พบกลุ่ม"); return }
      setGroupDetail(data.group)
      setSessions(data.sessions ?? [])
      setView("group-detail")
    } finally { setBusy(false) }
  }

  async function refreshGroupDetail(groupId: string) {
    if (!profile) return
    const res = await fetch(`/api/liff/sport-groups/${groupId}/sessions?lineUserId=${profile.userId}`)
    const data = await res.json()
    if (res.ok) { setGroupDetail(data.group); setSessions(data.sessions ?? []) }
  }

  async function generateMoreSessions() {
    if (!profile || !groupDetail) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/${groupDetail.id}/sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generateMore", lineUserId: profile.userId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ทำรายการไม่สำเร็จ"); return }
      setGroupDetail(data.group)
      setSessions(data.sessions ?? [])
    } finally { setBusy(false) }
  }

  async function openSessionDetail(id: string, opts?: { justCreated?: boolean }) {
    if (!profile) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/sessions/${id}?lineUserId=${profile.userId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ไม่พบกลุ่ม"); return }
      setSessionDetail(data.group)
      setView("session-detail")
      setJustCreated(!!opts?.justCreated)
      return data.group as SessionDetail
    } finally { setBusy(false) }
  }

  async function refreshSessionDetail(id: string) {
    if (!profile) return
    const res = await fetch(`/api/liff/sport-groups/sessions/${id}?lineUserId=${profile.userId}`)
    const data = await res.json()
    if (res.ok) setSessionDetail(data.group)
  }

  // ดึงรายละเอียดนัด โดยไม่เปลี่ยนหน้า/state ของ session-detail view
  async function fetchSessionDetail(id: string): Promise<SessionDetail | null> {
    if (!profile) return null
    const res = await fetch(`/api/liff/sport-groups/sessions/${id}?lineUserId=${profile.userId}`)
    const data = await res.json()
    if (!res.ok) return null
    return data.group as SessionDetail
  }

  async function doAction(action: "join" | "pay" | "unpay" | "finalize") {
    if (!profile || !sessionDetail) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/sessions/${sessionDetail.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lineUserId: profile.userId, displayName: profile.displayName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ทำรายการไม่สำเร็จ"); return }
      setSessionDetail(data.group)
      loadGroups(profile.userId)
    } finally { setBusy(false) }
  }

  async function createGroup(opts?: { thenShare?: boolean }) {
    if (!profile || !sportType) return
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/liff/sport-groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId, displayName: profile.displayName,
          sportType, venue: venue.trim() || undefined,
          recurringDays,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          courtNo: courtNo.trim() || undefined,
          mapUrl: mapUrl.trim() || undefined,
          maxPlayers: maxPlayers ? Number(maxPlayers) : undefined,
          lineGroupId: (liffGroupId && useLineGroupDefault) ? liffGroupId : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsConnect) setNeedsConnect(true)
        setError(data.error ?? "สร้างกลุ่มไม่สำเร็จ")
        return
      }
      setSportType(""); setVenue("")
      setRecurringDays([]); setStartTime(""); setEndTime(""); setCourtNo(""); setMapUrl(""); setMaxPlayers("")
      setVenueMode(null); setFavoriteVenues(null); setUseLineGroupDefault(true)
      await loadGroups(profile.userId)
      if (data.sessionIds?.length > 0) {
        const detail = await openSessionDetail(data.sessionIds[0], { justCreated: true })
        if (opts?.thenShare && detail) await shareInviteCard(detail)
      } else {
        await openGroupDetail(data.groupId)
      }
    } finally { setBusy(false) }
  }

  async function setMyGuests(n: number) {
    if (!profile || !sessionDetail) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/sessions/${sessionDetail.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setGuests", lineUserId: profile.userId, displayName: profile.displayName, guestCount: n }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ทำรายการไม่สำเร็จ"); return }
      setSessionDetail(data.group)
      setGuestDraft(null)
    } finally { setBusy(false) }
  }

  async function addExpense() {
    if (!profile || !sessionDetail || !expenseAmount || Number(expenseAmount) <= 0) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/sessions/${sessionDetail.id}/expenses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId, category: expenseCategory,
          label: expenseLabel.trim() || undefined, amount: Number(expenseAmount),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "เพิ่มค่าใช้จ่ายไม่สำเร็จ"); return }
      setSessionDetail(data.group)
      setExpenseLabel(""); setExpenseAmount("")
    } finally { setBusy(false) }
  }

  async function deleteExpense(expenseId: string) {
    if (!profile || !sessionDetail) return
    setBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/sessions/${sessionDetail.id}/expenses?id=${expenseId}&lineUserId=${profile.userId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ลบค่าใช้จ่ายไม่สำเร็จ"); return }
      setSessionDetail(data.group)
    } finally { setBusy(false) }
  }

  async function uploadProof(file: File) {
    if (!profile || !sessionDetail) return
    setProofBusy(true)
    try {
      const form = new FormData()
      form.append("lineUserId", profile.userId)
      form.append("file", file)
      const res = await fetch(`/api/liff/sport-groups/sessions/${sessionDetail.id}/proof`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "อัปโหลดสลิปไม่สำเร็จ"); return }
      setSessionDetail(data.group)
    } finally {
      setProofBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function deleteProof() {
    if (!profile || !sessionDetail) return
    setProofBusy(true)
    try {
      const res = await fetch(`/api/liff/sport-groups/sessions/${sessionDetail.id}/proof?lineUserId=${profile.userId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "ลบสลิปไม่สำเร็จ"); return }
      setSessionDetail(data.group)
    } finally { setProofBusy(false) }
  }

  // เลือกกลุ่ม LINE ที่จะโพสต์คำเชิญ → ส่ง "/sportinvite <code>" แบบ plain text
  // ผ่าน shareTargetPicker ไปที่แชทที่เลือก บอทจะตอบกลับด้วยการ์ดเชิญทันที
  // (เหมือน /linkgroup — เลี่ยงปัญหา flex+postback ส่งไม่ถึงผ่าน picker)
  async function shareInviteCard(detail?: SessionDetail) {
    const target = detail ?? sessionDetail
    if (!target) return
    setError(""); setNotice("")

    let liff: typeof import("@line/liff").default | null = null
    try {
      liff = (await import("@line/liff")).default
    } catch {
      setError("โหลด LINE SDK ไม่สำเร็จ — กรุณาเปิดผ่านแอป LINE")
      return
    }

    if (liff.isApiAvailable?.("shareTargetPicker")) {
      try {
        // ส่งเป็นข้อความธรรมดา "/sportinvite <code>" ไปที่แชทที่เลือก (ไม่มี
        // flex/postback จึงไม่มีกล่อง "ขออนุญาต" ของ LINE มาขวาง) — บอทจะตอบกลับ
        // ในแชทนั้นด้วยการ์ดเชิญทันที เหมือน /linkgroup
        const result = await liff.shareTargetPicker([
          { type: "text", text: `/sportinvite ${target.shareToken}` } as any,
        ])
        if (result) {
          setNotice("ส่งคำขอการ์ดเชิญแล้ว — บอทจะส่งการ์ดเชิญในกลุ่มที่เลือกทันที")
          setJustCreated(false)
        }
        // result === null → user cancelled the picker, no message needed
      } catch (err: any) {
        setError(`ส่งการ์ดเชิญไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
      }
      return
    }

    // shareTargetPicker unavailable (outside LINE app, or not enabled for this
    // LIFF channel) — fall back to copying the join link to clipboard.
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    const url = liffId
      ? `https://liff.line.me/${liffId}/liff/join/${target.shareToken}?type=split`
      : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://slippy.ai"}/split/join/${target.shareToken}`

    try {
      await navigator.clipboard.writeText(url)
      setNotice("ไม่สามารถเลือกกลุ่ม LINE ได้ที่นี่ — คัดลอกลิงก์เชิญแล้ว นำไปแชร์ในกลุ่มได้เลย")
    } catch {
      setError("ไม่สามารถเลือกกลุ่ม LINE หรือคัดลอกลิงก์ได้ — กรุณาเปิดผ่านแอป LINE")
    }
    setJustCreated(false)
  }

  // ปุ่ม "เลือกกลุ่ม LINE" ในหน้ากลุ่มประจำ — แชร์การ์ดเชิญของนัดที่ใกล้ที่สุด
  // ไปยังแชท LINE ที่เลือก ผ่าน shareTargetPicker
  async function shareGroupInvite() {
    if (!sessions || sessions.length === 0) {
      setError("ยังไม่มีนัดที่จะถึง — สร้างนัดก่อนเพื่อแชร์การ์ดเชิญ")
      return
    }
    setBusy(true); setError("")
    try {
      const detail = await fetchSessionDetail(sessions[0].id)
      if (!detail) { setError("ไม่พบนัดนี้"); return }
      await shareInviteCard(detail)
    } finally { setBusy(false) }
  }

  // แชร์ลิงก์เชิญไปยังแอปอื่น (Facebook/Messenger/Twitter/ฯลฯ) ผ่าน Web Share API
  // — หรือคัดลอกลิงก์ถ้าเบราว์เซอร์ไม่รองรับ
  async function shareInviteLink() {
    if (!sessionDetail) return
    setError(""); setNotice("")

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    const url = liffId
      ? `https://liff.line.me/${liffId}/liff/join/${sessionDetail.shareToken}?type=split`
      : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://slippy.ai"}/split/join/${sessionDetail.shareToken}`
    const title = `${sessionDetail.emoji} ชวนเล่น ${sessionDetail.title}`

    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url })
        setJustCreated(false)
      } catch (err: any) {
        if (err?.name !== "AbortError") setError(`แชร์ลิงก์ไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setNotice("คัดลอกลิงก์เชิญแล้ว — นำไปแชร์ที่ Facebook หรือแอปอื่นได้เลย")
      setJustCreated(false)
    } catch {
      setError("คัดลอกลิงก์ไม่สำเร็จ")
    }
  }

  // เชื่อมกลุ่ม LINE หลัก — เลือกแชทปลายทางผ่าน shareTargetPicker ของ LINE แล้ว
  // ส่งข้อความ "/linkgroup <code>" แบบ plain text ไปที่แชทนั้นโดยตรง (ไม่มี
  // flex/postback จึงไม่มีกล่อง "ขออนุญาต" ของ LINE มาขวาง) — บอทจะตอบกลับใน
  // แชทนั้นทันทีเหมือนตอนส่งรูปแล้วบอทตอบ "กำลังประมวลผล" เพราะอ่าน
  // event.source.groupId จากข้อความปกติได้แน่นอน
  async function pickLineGroupToLink(shareToken: string, title: string) {
    setError(""); setNotice("")

    let liff: typeof import("@line/liff").default | null = null
    try {
      liff = (await import("@line/liff")).default
    } catch {
      setError("โหลด LINE SDK ไม่สำเร็จ — กรุณาเปิดผ่านแอป LINE")
      return
    }

    if (liff.isApiAvailable?.("shareTargetPicker")) {
      try {
        const result = await liff.shareTargetPicker([
          { type: "text", text: `/linkgroup ${shareToken}` } as any,
        ])
        if (result) {
          setNotice("ส่งคำขอเชื่อมกลุ่มแล้ว — บอทจะตอบยืนยันในกลุ่มที่เลือกทันที")
        }
        // result === null → user cancelled the picker, no message needed
      } catch (err: any) {
        setError(`เลือกกลุ่ม LINE ไม่สำเร็จ: ${err?.message ?? "unknown error"}`)
      }
      return
    }

    // shareTargetPicker unavailable — fall back to /linkgroup instructions
    openLinkGroupPanel(title)
  }

  // เชื่อมกลุ่ม LINE หลัก — fallback เมื่อ shareTargetPicker ใช้ไม่ได้: ให้ผู้ใช้
  // พิมพ์ /linkgroup ในแชทกลุ่ม LINE ที่มี Slippy บอทอยู่แทน
  function openLinkGroupPanel(label: string) {
    setError(""); setNotice("")
    setLinkGroupPanel({ label })
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="w-7 h-7 animate-spin text-violet-600" />
        <p className="text-xs text-muted-foreground">กำลังเชื่อมต่อกับ LINE...</p>
      </div>
    )
  }

  // ── Opened outside the LINE app (external browser) ───────────────────────
  if (authStatus === "outsideLine") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg">🏸</div>
          <p className="font-semibold mb-1">เปิดจากแอป LINE เท่านั้น</p>
          <p className="text-sm text-muted-foreground">แตะเมนู "กลุ่มกีฬา" จากแชท Slippy ในแอป LINE เพื่อเข้าใช้งานแดชบอร์ดนี้</p>
        </div>
      </div>
    )
  }

  // ── LINE-branded login screen (only shown for LIFF — never the Slippy web login) ──
  if (authStatus === "needLogin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#06C755]/10 via-white to-violet-50 dark:from-[#06C755]/5 dark:via-slate-900 dark:to-slate-900">
        <div className="text-center max-w-xs w-full">
          <div className="w-16 h-16 rounded-2xl bg-[#06C755] flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
            💬
          </div>
          <p className="font-bold text-lg mb-1">เข้าสู่ระบบด้วยบัญชี LINE</p>
          <p className="text-sm text-muted-foreground mb-6">
            🏸 กลุ่มกีฬา Slippy ใช้บัญชี LINE ของคุณเพื่อระบุตัวตน — ไม่ต้องสมัครสมาชิกใหม่
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

  const me = sessionDetail?.participants.find(p => p.isMe)

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-4 pb-10">
      <div className="max-w-md mx-auto">

        {error && (
          <div className="mb-3 flex items-start gap-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="font-bold">×</button>
          </div>
        )}

        {notice && (
          <div className="mb-3 flex items-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice("")} className="font-bold">×</button>
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
              <h1 className="text-lg font-bold flex items-center gap-1.5">🏸 กลุ่มกีฬาของฉัน</h1>
              <button
                onClick={() => { setView("create"); setError(""); setVenueMode(null); setFavoriteVenues(null) }}
                className="h-9 px-3.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" /> สร้างกลุ่ม
              </button>
            </div>

            {needsConnect && (
              <div className="mb-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <p>💡 ยังไม่ได้เชื่อมบัญชี — เชื่อมก่อนเพื่อสร้าง/จัดการกลุ่มได้เต็มรูปแบบ (ดูยังได้ตามปกติ)</p>
                <a
                  href="/api/auth/line?next=/liff/sport"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#06C755] text-white text-xs font-semibold active:scale-95 transition-transform"
                >
                  เข้าสู่ระบบด้วย LINE (เชื่อมอัตโนมัติ)
                </a>
                <p className="text-amber-700/80 dark:text-amber-300/70">หรือพิมพ์ <b>/connect CODE</b> ในแชท Slippy</p>
              </div>
            )}

            {(groups === null || legacySessions === null) && (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
            )}

            {groups?.length === 0 && legacySessions?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">🏸</p>
                <p className="font-semibold">ยังไม่มีกลุ่มกีฬา</p>
                <p className="text-sm text-muted-foreground mt-1">กดปุ่ม "สร้างกลุ่ม" เพื่อตั้งกลุ่มแรกของคุณ</p>
              </div>
            )}

            {groups !== null && groups.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">🔁 กลุ่มประจำของฉัน</p>
                <div className="space-y-2.5">
                  {groups.map(g => (
                    <div
                      key={g.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openGroupDetail(g.id)}
                      onKeyDown={e => { if (e.key === "Enter") openGroupDetail(g.id) }}
                      className="w-full text-left bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all flex items-center gap-3 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20 flex items-center justify-center text-2xl shrink-0">
                        {g.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{g.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{recurringDaysLabel(g.recurringDays)}</p>
                        {(g.defaultStartTime || g.defaultVenue) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {timeRangeLabel(g.defaultStartTime, g.defaultEndTime)}
                            {g.defaultStartTime && g.defaultVenue ? " · " : ""}{g.defaultVenue}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                            {g.upcomingSessionCount} เซสชันที่จะถึง
                          </span>
                          {g.nextSessionDate && <span>ถัดไป {thaiDateLabel(g.nextSessionDate)}</span>}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteGroup(g.id) }}
                        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        aria-label="ลบกลุ่ม"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {legacySessions !== null && legacySessions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">📌 เซสชันเดี่ยว</p>
                <div className="space-y-2.5">
                  {legacySessions.map(g => (
                    <div
                      key={g.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openSessionDetail(g.id)}
                      onKeyDown={e => { if (e.key === "Enter") openSessionDetail(g.id) }}
                      className="w-full text-left bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all flex items-center gap-3 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20 flex items-center justify-center text-2xl shrink-0">
                        {g.emoji}
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
                        {(g.bookingDate || g.startTime) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {thaiDateLabel(g.bookingDate)}{g.bookingDate && (g.startTime || g.courtNo) ? " · " : ""}
                            {timeRangeLabel(g.startTime, g.endTime)}{g.startTime && g.courtNo ? " · " : ""}{g.courtNo}
                          </p>
                        )}
                        {g.venue && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{g.venue}</p>}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="font-semibold text-violet-600 dark:text-violet-400">{fmtTHB(g.fee)}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{g.headCount} คน</span>
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{g.paidCount}/{g.headCount} จ่ายแล้ว</span>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteLegacySession(g.id) }}
                        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        aria-label="ลบเซสชัน"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ───────────── CREATE VIEW ───────────── */}
        {view === "create" && (
          <>
            <Header title="สร้างกลุ่มกีฬาใหม่" onBack={() => setView("list")} />
            <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">เลือกชนิดกีฬา</p>
                <div className="grid grid-cols-3 gap-2">
                  {SPORT_OPTIONS.map(s => (
                    <button
                      key={s.label}
                      onClick={() => setSportType(s.label)}
                      className={cn(
                        "rounded-xl border-2 py-2.5 flex flex-col items-center gap-1 text-xs font-medium transition-colors",
                        sportType === s.label ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300" : "border-transparent bg-muted/50"
                      )}
                    >
                      <span className="text-xl">{s.emoji}</span>{s.label}
                    </button>
                  ))}
                </div>
                <input
                  value={sportType} onChange={e => setSportType(e.target.value)}
                  placeholder="หรือพิมพ์เอง เช่น แบดมินตัน"
                  className="mt-2 w-full h-10 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                />
              </div>

              {liffGroupId ? (
                <button
                  type="button"
                  onClick={() => setUseLineGroupDefault(v => !v)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition-colors",
                    useLineGroupDefault ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-transparent bg-muted/50"
                  )}
                >
                  {useLineGroupDefault ? <CheckCircle2 className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-sm font-semibold">📍 ตั้งกลุ่มแชทนี้เป็นกลุ่มหลัก</p>
                    <p className="text-xs text-muted-foreground mt-0.5">การ์ดเชิญและแจ้งเตือนของนัดนี้จะถูกส่งเข้ากลุ่ม LINE ที่เปิดหน้านี้อยู่โดยอัตโนมัติ</p>
                  </div>
                </button>
              ) : (
                <div className="w-full flex items-start gap-3 p-3 rounded-2xl bg-muted/50">
                  <Link2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">📍 เลือกกลุ่ม LINE</p>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">สร้างกลุ่มแล้วเลือกแชท LINE เพื่อส่งการ์ดเชิญไปทันที (เชื่อมกลุ่มหลักสำหรับแจ้งเตือนทำได้หลังสร้างกลุ่ม)</p>
                    <button
                      type="button"
                      onClick={() => createGroup({ thenShare: true })}
                      disabled={!sportType || busy}
                      className="h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />} เลือกกลุ่ม LINE
                    </button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold mb-2">สนาม (ไม่บังคับ)</p>

                {/* Selected venue chip */}
                {venue && (
                  <div className="flex items-center gap-2 mb-2 p-3 rounded-xl border-2 border-violet-200 bg-violet-50 dark:bg-violet-500/10">
                    <MapPin className="w-4 h-4 text-violet-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{venue}</p>
                      {mapUrl && <p className="text-xs text-muted-foreground truncate">{mapUrl}</p>}
                    </div>
                    <button onClick={() => { setVenue(""); setMapUrl(""); setVenueMode(null) }}
                      className="text-xs text-muted-foreground underline shrink-0">เปลี่ยน</button>
                  </div>
                )}

                {/* 3-way chooser */}
                {!venue && venueMode === null && (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        sessionStorage.removeItem("slippy_place_picker_result")
                        sessionStorage.setItem("slippy_sport_create_draft", JSON.stringify({
                          sportType, recurringDays, startTime, endTime, courtNo, maxPlayers,
                        }))
                        router.push(`/liff/places?picker=sport&lineUserId=${profile?.userId ?? ""}`)
                      }}
                      className="rounded-xl border-2 border-transparent bg-muted/50 py-3 flex flex-col items-center gap-1.5 text-xs font-medium"
                    >
                      <Navigation className="w-5 h-5 text-violet-600" /> ใกล้ฉัน<br />(แผนที่)
                    </button>
                    <button
                      onClick={() => { setVenueMode("favorite"); if (profile) loadFavoriteVenues(profile.userId) }}
                      className="rounded-xl border-2 border-transparent bg-muted/50 py-3 flex flex-col items-center gap-1.5 text-xs font-medium"
                    >
                      <Star className="w-5 h-5 text-violet-600" /> สนามที่<br />เคยใช้
                    </button>
                    <button
                      onClick={() => setVenueMode("manual")}
                      className="rounded-xl border-2 border-transparent bg-muted/50 py-3 flex flex-col items-center gap-1.5 text-xs font-medium"
                    >
                      <Pencil className="w-5 h-5 text-violet-600" /> พิมพ์เอง
                    </button>
                  </div>
                )}

                {/* สนามที่เคยใช้ */}
                {!venue && venueMode === "favorite" && (
                  <div className="space-y-2">
                    {favoriteVenues === null && (
                      <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    )}
                    {favoriteVenues?.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">ยังไม่มีสนามที่เคยใช้</p>
                    )}
                    {favoriteVenues?.map(v => (
                      <button key={v.venue}
                        onClick={() => { setVenue(v.venue); setMapUrl(v.mapUrl ?? ""); if (v.courtNo) setCourtNo(v.courtNo) }}
                        className="w-full flex items-center gap-2 p-3 rounded-xl border text-left text-sm hover:bg-muted/50"
                      >
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                        <span className="flex-1 truncate font-medium">{v.venue}</span>
                        <Check className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                    <button onClick={() => setVenueMode(null)} className="text-xs text-muted-foreground underline">← เลือกวิธีอื่น</button>
                  </div>
                )}

                {/* พิมพ์เอง */}
                {!venue && venueMode === "manual" && (
                  <div className="space-y-2">
                    <input
                      value={venue} onChange={e => setVenue(e.target.value)}
                      placeholder="ชื่อสนาม เช่น SP Badminton Court"
                      className="w-full h-11 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                    />
                    <input
                      value={mapUrl} onChange={e => setMapUrl(e.target.value)}
                      placeholder="ลิงก์แผนที่ (ไม่บังคับ) https://maps.app.goo.gl/..."
                      className="w-full h-11 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                    />
                    <button onClick={() => setVenueMode(null)} className="text-xs text-muted-foreground underline">← เลือกวิธีอื่น</button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">วันที่เล่นประจำ</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      onClick={() => setRecurringDays(d => d.includes(idx) ? d.filter(x => x !== idx) : [...d, idx].sort())}
                      className={cn(
                        "rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors",
                        recurringDays.includes(idx) ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300" : "border-transparent bg-muted/50"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {recurringDays.length > 0
                    ? `ระบบจะสร้างเซสชัน ${recurringDaysLabel(recurringDays)} ให้ล่วงหน้า 4 สัปดาห์`
                    : "ไม่เลือกก็ได้ — แล้วค่อยเพิ่มเซสชันแบบครั้งเดียวทีหลัง"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm font-semibold mb-2">เวลาเริ่ม</p>
                  <input
                    type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full min-w-0 h-11 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">เวลาเลิก</p>
                  <input
                    type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full min-w-0 h-11 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">คอร์ด/สนาม (ไม่บังคับ)</p>
                <input
                  value={courtNo} onChange={e => setCourtNo(e.target.value)}
                  placeholder="เช่น คอร์ด No.2"
                  className="w-full h-11 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">จำนวนคนสูงสุด (ไม่บังคับ)</p>
                <input
                  type="number" inputMode="numeric" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)}
                  placeholder="เช่น 8"
                  className="w-full h-11 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                />
              </div>

              <button
                onClick={() => createGroup()}
                disabled={!sportType || busy}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "สร้างกลุ่ม →"}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                💡 เพิ่มค่าใช้จ่าย (ค่าเล่น/ค่าลูกแบด/เครื่องดื่ม/ขนม) ทีละเซสชันได้ — ระบบจะหารเท่าๆ กันให้อัตโนมัติ
              </p>
            </div>
          </>
        )}

        {/* ───────────── GROUP-DETAIL VIEW ───────────── */}
        {view === "group-detail" && groupDetail && (
          <>
            <Header title={`${groupDetail.emoji} ${groupDetail.title}`} onBack={() => { setView("list"); setGroupDetail(null); setSessions(null) }} />

            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg mb-3 space-y-1.5">
              <p className="text-sm font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />{recurringDaysLabel(groupDetail.recurringDays)}
              </p>
              {(groupDetail.defaultStartTime || groupDetail.defaultCourtNo) && (
                <p className="text-xs text-white/80 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {timeRangeLabel(groupDetail.defaultStartTime, groupDetail.defaultEndTime)}
                  {groupDetail.defaultStartTime && groupDetail.defaultCourtNo ? " · " : ""}
                  {groupDetail.defaultCourtNo}
                </p>
              )}
              {groupDetail.defaultVenue && (
                <a
                  href={groupDetail.defaultMapUrl ?? undefined}
                  target="_blank" rel="noreferrer"
                  className={cn("text-xs text-white/80 flex items-center gap-1", groupDetail.defaultMapUrl && "underline underline-offset-2")}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{groupDetail.defaultVenue}</span>
                </a>
              )}
              {groupDetail.maxPlayers && (
                <p className="text-xs text-white/80 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />สูงสุด {groupDetail.maxPlayers} คน</p>
              )}
            </div>

            {/* เลือกกลุ่ม LINE เพื่อแชร์การ์ดเชิญของนัดถัดไป */}
            <button
              onClick={shareGroupInvite}
              disabled={busy || !sessions?.length}
              className="w-full h-10 mb-3 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} เลือกกลุ่ม LINE (ส่งการ์ดเชิญนัดถัดไป)
            </button>

            {/* สถานะกลุ่ม LINE หลัก — ผูกไว้แล้วหรือยัง พร้อมปุ่มเชื่อม/เปลี่ยน */}
            <div className="mb-3 flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 text-xs">
              {groupDetail.lineGroupId ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="flex-1 text-muted-foreground">เชื่อมกลุ่ม LINE หลักไว้แล้ว — การ์ดเชิญ/แจ้งเตือนของนัดต่อๆไปจะส่งเข้ากลุ่มนี้อัตโนมัติ</span>
                  <button
                    onClick={() => pickLineGroupToLink(groupDetail.shareToken, groupDetail.title)}
                    disabled={busy}
                    className="shrink-0 text-violet-600 font-semibold underline disabled:opacity-50"
                  >
                    เปลี่ยน
                  </button>
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-muted-foreground">ยังไม่ได้เชื่อมกลุ่ม LINE หลัก</span>
                  <button
                    onClick={() => pickLineGroupToLink(groupDetail.shareToken, groupDetail.title)}
                    disabled={busy}
                    className="shrink-0 text-violet-600 font-semibold underline disabled:opacity-50"
                  >
                    เชื่อมกลุ่ม
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">เซสชันที่จะถึง</p>
              <button
                onClick={generateMoreSessions} disabled={busy}
                className="h-8 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                สร้างเซสชันเพิ่ม
              </button>
            </div>

            {sessions?.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">ยังไม่มีเซสชัน</div>
            )}

            <div className="space-y-2.5">
              {sessions?.map(s => (
                <button
                  key={s.id}
                  onClick={() => openSessionDetail(s.id)}
                  className="w-full text-left bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20 flex items-center justify-center text-2xl shrink-0">
                    {s.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold truncate">{thaiDateLabel(s.bookingDate)}</p>
                      {s.status === "finalized" && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> ปิดแล้ว
                        </span>
                      )}
                      {s.isMember && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                          เข้าร่วมแล้ว
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {timeRangeLabel(s.startTime, s.endTime)}{s.startTime && s.courtNo ? " · " : ""}{s.courtNo}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-violet-600 dark:text-violet-400">{fmtTHB(s.fee)}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.headCount} คน</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{s.paidCount}/{s.headCount} จ่ายแล้ว</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* ───────────── SESSION-DETAIL VIEW ───────────── */}
        {view === "session-detail" && sessionDetail && (
          <>
            <Header
              title={`${sessionDetail.emoji} ${sessionDetail.title}`}
              onBack={() => {
                if (sessionDetail.sportGroupId) { openGroupDetail(sessionDetail.sportGroupId) }
                else { setView("list"); setSessionDetail(null) }
                setJustCreated(false)
              }}
            />

            {sessionDetail.sportGroupId && sessionDetail.groupTitle && (
              <p className="text-xs text-muted-foreground mb-2 -mt-2">🔁 {sessionDetail.groupTitle}</p>
            )}

            {/* เลือกกลุ่ม LINE ที่จะโพสต์คำเชิญ — shown once right after a new
                group is created; the chosen chat receives the invite Flex card. */}
            {justCreated && (
              <div className="mb-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0">🎉</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-800">สร้างกลุ่มสำเร็จ!</p>
                    <p className="text-xs text-amber-700 mt-0.5">เลือกกลุ่ม LINE, เชื่อมกลุ่มหลัก หรือแชร์ลิงก์ไปที่อื่นเพื่อชวนเพื่อน</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => shareInviteCard()} disabled={busy}
                    className="h-9 px-2 rounded-xl bg-amber-500 text-white text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50">
                    เลือกกลุ่ม LINE
                  </button>
                  <button
                    onClick={() => pickLineGroupToLink(sessionDetail.shareToken, sessionDetail.groupTitle ?? sessionDetail.title)}
                    disabled={busy}
                    className="h-9 px-2 rounded-xl bg-white border border-amber-300 text-amber-700 text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50">
                    เชื่อมกลุ่มหลัก
                  </button>
                  <button onClick={shareInviteLink} disabled={busy}
                    className="h-9 px-2 rounded-xl bg-white border border-amber-300 text-amber-700 text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50">
                    แชร์ลิงก์
                  </button>
                </div>
              </div>
            )}

            {/* สถานะกลุ่ม LINE หลัก — ผูกไว้แล้วหรือยัง พร้อมปุ่มเชื่อม/เปลี่ยน */}
            <div className="mb-3 flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 text-xs">
              {sessionDetail.lineGroupId ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="flex-1 text-muted-foreground">เชื่อมกลุ่ม LINE หลักไว้แล้ว — การ์ดเชิญ/แจ้งเตือนของนัดต่อๆไปจะส่งเข้ากลุ่มนี้อัตโนมัติ</span>
                  <button
                    onClick={() => pickLineGroupToLink(sessionDetail.shareToken, sessionDetail.groupTitle ?? sessionDetail.title)}
                    disabled={busy}
                    className="shrink-0 text-violet-600 font-semibold underline disabled:opacity-50"
                  >
                    เปลี่ยน
                  </button>
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-muted-foreground">ยังไม่ได้เชื่อมกลุ่ม LINE หลัก</span>
                  <button
                    onClick={() => pickLineGroupToLink(sessionDetail.shareToken, sessionDetail.groupTitle ?? sessionDetail.title)}
                    disabled={busy}
                    className="shrink-0 text-violet-600 font-semibold underline disabled:opacity-50"
                  >
                    เชื่อมกลุ่ม
                  </button>
                </>
              )}
            </div>

            {sessionDetail.status !== "finalized" && isRegistrationClosed(sessionDetail) && (
              <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-sm font-semibold text-amber-800">⏰ เกินกำหนดการลงทะเบียนแล้ว — ปิดรับสมาชิกใหม่</p>
              </div>
            )}

            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg mb-3">
              {/* Event header — mirrors the LINE group announcement format:
                  "ตีแบด พุธที่ 10 มิ.ย. / เวลา 2-4 ทุ่ม 1 คอร์ด No.2" */}
              {(sessionDetail.bookingDate || sessionDetail.startTime || sessionDetail.courtNo) && (
                <div className="mb-2 pb-2 border-b border-white/15 space-y-0.5">
                  {sessionDetail.bookingDate && (
                    <p className="text-sm font-bold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />{thaiDateLabel(sessionDetail.bookingDate)}
                    </p>
                  )}
                  {(sessionDetail.startTime || sessionDetail.courtNo) && (
                    <p className="text-xs text-white/80 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {timeRangeLabel(sessionDetail.startTime, sessionDetail.endTime)}
                      {sessionDetail.startTime && sessionDetail.courtNo ? " · " : ""}
                      {sessionDetail.courtNo}
                    </p>
                  )}
                </div>
              )}

              {sessionDetail.venue && (
                <a
                  href={sessionDetail.mapUrl ?? undefined}
                  target="_blank" rel="noreferrer"
                  className={cn("text-sm text-white/80 flex items-center gap-1 mb-1", sessionDetail.mapUrl && "underline underline-offset-2")}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{sessionDetail.venue}</span>
                  {sessionDetail.mapUrl && <span className="ml-1 shrink-0">★★★★★</span>}
                </a>
              )}

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-white/70">ยอดรวม</p>
                  <p className="text-2xl font-black">{fmtTHB(sessionDetail.fee)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/70">ต่อคน</p>
                  <p className="text-lg font-bold">{fmtTHB(sessionDetail.participants.find(p => p.isMe)?.amount ?? sessionDetail.participants[0]?.amount ?? sessionDetail.fee)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-white/80">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {sessionDetail.participants.reduce((s, p) => s + 1 + p.guestCount, 0)} คน
                  {sessionDetail.maxPlayers ? ` / ${sessionDetail.maxPlayers}` : ""}
                </span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{fmtTHB(sessionDetail.paidTotal)} จ่ายแล้ว</span>
                {sessionDetail.status === "finalized" && (
                  <span className="ml-auto flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5"><Lock className="w-3 h-3" />ปิดกลุ่มแล้ว</span>
                )}
              </div>
            </div>

            {/* Expense breakdown */}
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm mb-3">
              <p className="text-xs font-semibold text-muted-foreground px-4 pt-3 pb-1">
                ค่าใช้จ่าย (รวม {fmtTHB(sessionDetail.expensesTotal)})
              </p>
              {sessionDetail.expenses.length === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-3">ยังไม่มีรายการ — เพิ่มค่าเล่น ค่าลูกแบด เครื่องดื่ม ฯลฯ ด้านล่าง</p>
              )}
              {sessionDetail.expenses.map(exp => {
                const info = expenseCategoryInfo(exp.category)
                return (
                  <div key={exp.id} className="flex items-center justify-between px-4 py-2.5 border-t first:border-t-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{info.emoji}</span>
                      <span className="text-sm truncate">{exp.label || info.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold">{fmtTHB(exp.amount)}</span>
                      {sessionDetail.status !== "finalized" && (
                        <button onClick={() => deleteExpense(exp.id)} disabled={busy} className="text-muted-foreground/60 hover:text-rose-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {sessionDetail.status !== "finalized" && (
                <div className="border-t p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}
                      className="h-10 rounded-xl border px-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                    >
                      {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                    </select>
                    <input
                      type="number" inputMode="decimal" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                      placeholder="จำนวนเงิน"
                      className="h-10 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={expenseLabel} onChange={e => setExpenseLabel(e.target.value)}
                      placeholder="รายละเอียด (ไม่บังคับ)"
                      className="flex-1 h-10 rounded-xl border px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                    />
                    <button
                      onClick={addExpense}
                      disabled={busy || !expenseAmount || Number(expenseAmount) <= 0}
                      className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> เพิ่ม
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm mb-3">
              <p className="text-xs font-semibold text-muted-foreground px-4 pt-3 pb-1">
                รายชื่อ ({sessionDetail.participants.reduce((s, p) => s + 1 + p.guestCount, 0)})
              </p>
              {sessionDetail.participants.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-t first:border-t-0 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0 tabular-nums">{i + 1}.</span>
                    {p.paid ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                    <span className={cn("text-sm truncate", p.isMe && "font-bold")}>
                      {p.name}{p.isMe && " (คุณ)"}{p.guestCount > 0 && ` +${p.guestCount}`}
                    </span>
                    {p.paymentProofUrl && (
                      <a href={p.paymentProofUrl} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={p.paymentProofUrl} alt="สลิป" className="w-7 h-7 rounded-lg object-cover border" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.isMe && sessionDetail.status !== "finalized" && (
                      guestDraft !== null ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setGuestDraft(Math.max(0, guestDraft - 1))} className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">−</button>
                          <span className="text-xs w-3 text-center tabular-nums">{guestDraft}</span>
                          <button onClick={() => setGuestDraft(Math.min(5, guestDraft + 1))} className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">+</button>
                          <button onClick={() => setMyGuests(guestDraft)} disabled={busy} className="text-[10px] font-bold text-violet-600 px-1.5">บันทึก</button>
                        </div>
                      ) : (
                        <button onClick={() => setGuestDraft(p.guestCount)} className="text-muted-foreground/60 hover:text-violet-600">
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                    {p.isMe && sessionDetail.status !== "finalized" && (
                      p.paymentProofUrl ? (
                        <button onClick={deleteProof} disabled={proofBusy} className="text-muted-foreground/60 hover:text-rose-600">
                          {proofBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <button onClick={() => fileInputRef.current?.click()} disabled={proofBusy} className="text-muted-foreground/60 hover:text-violet-600">
                          {proofBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                        </button>
                      )
                    )}
                    <span className={cn("text-sm font-semibold", p.paid ? "text-emerald-600" : "text-muted-foreground")}>{fmtTHB(p.amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            <input
              ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadProof(f) }}
            />
            <p className="text-xs text-muted-foreground -mt-2 mb-3 px-1">
              📸 แตะไอคอนกล้องข้างชื่อคุณ เพื่ออัปโหลดสลิป/ภาพโอนเงิน — ระบบจะมาร์คว่าจ่ายแล้วอัตโนมัติ
            </p>

            <div className="space-y-2">
              {sessionDetail.status !== "finalized" && (
                <>
                  {me ? (
                    <button
                      onClick={() => doAction(me?.paid ? "unpay" : "pay")}
                      disabled={busy}
                      className={cn(
                        "w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50",
                        me?.paid
                          ? "bg-muted text-foreground border"
                          : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                      )}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : me?.paid ? "↺ ยกเลิกการจ่าย" : "✅ จ่ายแล้ว — กดยืนยัน"}
                    </button>
                  ) : (
                    <button
                      onClick={() => doAction("join")}
                      disabled={busy}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "🙋 เข้าร่วมกลุ่มนี้"}
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => shareInviteCard()} className="h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                      <Share2 className="w-4 h-4" /> ส่งการ์ดเชิญ
                    </button>
                    <button onClick={shareInviteLink} className="h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                      <Share className="w-4 h-4" /> แชร์ลิงก์
                    </button>
                  </div>
                  <button
                    onClick={() => doAction("finalize")}
                    disabled={busy}
                    className="w-full h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5 text-rose-600 border-rose-200 dark:border-rose-500/30 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" /> ปิดกลุ่ม / สรุปยอด
                  </button>
                </>
              )}
              {sessionDetail.status === "finalized" && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => shareInviteCard()} className="h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5">
                    <Share2 className="w-4 h-4" /> แชร์สรุปยอด
                  </button>
                  <button onClick={shareInviteLink} className="h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5">
                    <Share className="w-4 h-4" /> แชร์ลิงก์
                  </button>
                </div>
              )}
              <button onClick={() => refreshSessionDetail(sessionDetail.id)} className="w-full text-xs text-muted-foreground py-1">
                ↻ รีเฟรชสถานะ
              </button>
            </div>
          </>
        )}

      </div>

      {/* แผงเชื่อมกลุ่ม LINE — แนะนำให้พิมพ์ /linkgroup ในแชทกลุ่ม แล้วเลือก+ยืนยันในแชทนั้น */}
      {linkGroupPanel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setLinkGroupPanel(null)}>
          <div className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-7 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">🔗 เชื่อมกลุ่ม LINE หลัก</p>
              <button onClick={() => setLinkGroupPanel(null)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              เปิดแชทกลุ่ม LINE ที่มี Slippy บอทเป็นสมาชิก แล้วพิมพ์ <span className="font-mono font-semibold">/linkgroup</span> ส่งในกลุ่ม
            </p>
            <p className="text-xs text-muted-foreground">
              บอทจะส่งรายการกลุ่ม/นัดให้เลือก — แตะ &quot;{linkGroupPanel.label}&quot; แล้วกด <span className="font-semibold">✓ อนุญาต</span> เพื่อยืนยัน
            </p>
            <p className="text-xs text-muted-foreground">หลังยืนยันแล้ว การ์ดเชิญและแจ้งเตือนของนัดต่อๆไปจะถูกส่งเข้ากลุ่มนี้อัตโนมัติ</p>
          </div>
        </div>
      )}
    </div>
  )
}
