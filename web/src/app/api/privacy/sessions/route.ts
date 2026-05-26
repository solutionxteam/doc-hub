import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// ── Simple UA → device/browser/os parser (no deps) ──────────────────────────
function parseUA(ua: string) {
  const mob     = /Mobile|Android|iPhone|iPad/i.test(ua)
  const tablet  = /iPad|Tablet/i.test(ua)
  const type    = tablet ? "tablet" : mob ? "mobile" : "desktop"

  const browser = ua.match(/Edg\//)     ? "Edge"
    : ua.match(/OPR\/|Opera/)           ? "Opera"
    : ua.match(/Chrome\//)              ? "Chrome"
    : ua.match(/Firefox\//)             ? "Firefox"
    : ua.match(/Safari\//)              ? "Safari"
    : ua.match(/SamsungBrowser/)        ? "Samsung Browser"
    : "Unknown"

  const os = ua.match(/Windows NT/)    ? "Windows"
    : ua.match(/Mac OS X/)             ? "macOS"
    : ua.match(/iPhone OS/)            ? "iOS"
    : ua.match(/Android/)              ? "Android"
    : ua.match(/Linux/)                ? "Linux"
    : "Unknown"

  const device = type === "mobile"
    ? (ua.match(/iPhone/) ? "iPhone"
      : ua.match(/Samsung/) ? "Samsung Galaxy"
      : "Android Phone")
    : type === "tablet" ? "iPad"
    : `${os} · ${browser}`

  return { type, browser, os, device }
}

// Safe identifier from token — first 8 + last 4 chars, never exposes full JWT
function tokenHash(token: string) {
  return token.slice(0, 8) + token.slice(-4)
}

// ── GET: upsert current session, return all sessions ────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = session.user
  const ua   = req.headers.get("user-agent") ?? ""
  const ip   = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null
  const { type, browser, os, device } = parseUA(ua)
  const hash = tokenHash(session.access_token)

  // Upsert current session
  await supabase.from("user_sessions").upsert({
    user_id:     user.id,
    token_hash:  hash,
    device_name: device,
    device_type: type,
    os,
    browser,
    ip_address:  ip,
    location:    null,   // geolocation would need IP lookup service
    last_active: new Date().toISOString(),
  }, { onConflict: "user_id,token_hash" })

  // Fetch all sessions for this user
  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("id,device_name,device_type,os,browser,ip_address,location,last_active,created_at,token_hash")
    .eq("user_id", user.id)
    .order("last_active", { ascending: false })

  return NextResponse.json({ sessions: sessions ?? [], currentHash: hash })
}

// ── DELETE: sign out from all sessions ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Remove all tracked sessions
  await supabase.from("user_sessions").delete().eq("user_id", user.id)

  // Log activity
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null
  await supabase.from("user_activity_logs").insert({
    user_id: user.id, action: "session_revoke_all",
    detail: "ออกจากระบบทุกอุปกรณ์", ip_address: ip,
  })

  // Sign out from ALL sessions globally (Supabase v2 scope:'global')
  await supabase.auth.signOut({ scope: "global" })

  return NextResponse.json({ ok: true, redirectTo: "/auth/login" })
}
