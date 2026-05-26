/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

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

// POST — generate a new connect code (stored in line_connection_tokens)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await req.json() as { orgId: string }
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  const code      = randomCode(6)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

  const admin = createAdminClient()

  // Expire any previous unused tokens for this org
  await admin
    .from("line_connection_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .is("used_at", null)

  // Insert new token (use our short code as the token field)
  const { error } = await admin
    .from("line_connection_tokens")
    .insert({
      token:           code,
      user_id:         user.id,
      organization_id: orgId,
      expires_at:      expiresAt,
    })

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
    .select("id, line_user_id, display_name, user_id, created_at")
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
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from("line_connections")
    .delete()
    .eq("id", connectionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
