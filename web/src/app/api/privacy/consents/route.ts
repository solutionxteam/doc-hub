import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_CONSENTS = {
  necessary: true, ai: true, analytics: true,
  marketing: false, research: false, cross_border: false,
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("user_consents")
    .select("necessary,ai,analytics,marketing,research,cross_border,updated_at")
    .eq("user_id", user.id)
    .single()

  return NextResponse.json(data ?? DEFAULT_CONSENTS)
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const patch = {
    user_id:     user.id,
    necessary:   true, // always locked
    ai:          Boolean(body.ai),
    analytics:   Boolean(body.analytics),
    marketing:   Boolean(body.marketing),
    research:    Boolean(body.research),
    cross_border: Boolean(body.cross_border),
    updated_at:  new Date().toISOString(),
  }

  const { error } = await supabase
    .from("user_consents")
    .upsert(patch, { onConflict: "user_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null
  await supabase.from("user_activity_logs").insert({
    user_id: user.id, action: "consent_update",
    detail: "อัปเดตความยินยอม PDPA", ip_address: ip,
  })

  return NextResponse.json({ ok: true })
}
