import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const format: string = body.format ?? "csv"

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null
  await supabase.from("user_activity_logs").insert({
    user_id:    user.id,
    action:     "export_request",
    detail:     `ขอส่งออกข้อมูล (${format.toUpperCase()})`,
    ip_address: ip,
  })

  // TODO: enqueue actual export job (Supabase Edge Function / queue)
  // For now: acknowledge the request, email will be sent within 24h

  return NextResponse.json({ ok: true, email: user.email })
}
