import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Require explicit confirmation text
  if (body.confirm !== "ลบบัญชี") {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 })
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null

  // Log the request before deletion
  await supabase.from("user_activity_logs").insert({
    user_id:    user.id,
    action:     "account_delete_request",
    detail:     "ขอลบบัญชีและข้อมูลทั้งหมด",
    ip_address: ip,
  })

  // Sign out all sessions first
  await supabase.auth.signOut({ scope: "global" })

  // Delete the auth user (cascades to all tables via ON DELETE CASCADE)
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: "ไม่สามารถลบบัญชีได้ กรุณาติดต่อ privacy@slippy.app" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, redirectTo: "/" })
}
