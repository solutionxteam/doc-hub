import { NextRequest, NextResponse } from "next/server"
import { createClient }      from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no ambiguous chars
  let code = ""
  for (let i = 0; i < len; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// POST — generate a new connect code
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await req.json() as { orgId: string }

  const code      = randomCode(6)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

  const admin = createAdminClient()
  const { error } = await admin
    .from("organizations")
    .update({ line_connect_code: code, line_connect_expires_at: expiresAt })
    .eq("id", orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ code, expiresAt })
}

// GET — list LINE connections for an org
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = req.nextUrl.searchParams.get("orgId")
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  const { data: connections } = await supabase
    .from("line_connections")
    .select("id, line_user_id, display_name, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ connections: connections ?? [] })
}

// DELETE — disconnect a LINE user
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { connectionId } = await req.json() as { connectionId: string }
  const admin = createAdminClient()
  await admin.from("line_connections").delete().eq("id", connectionId)

  return NextResponse.json({ ok: true })
}
