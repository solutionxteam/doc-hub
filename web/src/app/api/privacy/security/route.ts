import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_PREFS = { login_alerts: true, auto_lock: "5min" }

const LOCK_VALUES = ["immediate","1min","5min","30min","never"] as const
type LockValue = typeof LOCK_VALUES[number]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("user_security_prefs")
    .select("login_alerts,auto_lock,updated_at")
    .eq("user_id", user.id)
    .single()

  return NextResponse.json(data ?? DEFAULT_PREFS)
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const autoLock: LockValue = LOCK_VALUES.includes(body.auto_lock) ? body.auto_lock : "5min"

  const { error } = await supabase.from("user_security_prefs").upsert({
    user_id:      user.id,
    login_alerts: Boolean(body.login_alerts),
    auto_lock:    autoLock,
    updated_at:   new Date().toISOString(),
  }, { onConflict: "user_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null
  await supabase.from("user_activity_logs").insert({
    user_id: user.id, action: "security_update",
    detail: "อัปเดตการตั้งค่าความปลอดภัย", ip_address: ip,
  })

  return NextResponse.json({ ok: true })
}
