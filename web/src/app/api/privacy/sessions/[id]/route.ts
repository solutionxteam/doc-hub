import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// DELETE /api/privacy/sessions/[id] — remove a specific tracked session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Only allow deleting own sessions (RLS also enforces this)
  const { error } = await supabase
    .from("user_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null
  await supabase.from("user_activity_logs").insert({
    user_id: user.id, action: "session_revoke",
    detail: "ออกจากระบบอุปกรณ์", ip_address: ip,
  })

  return NextResponse.json({ ok: true })
}
