/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

import { NextResponse }      from "next/server"
import { createClient }      from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ── Guard helper ─────────────────────────────────────────────────────────────
async function assertSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single()

  return profile?.is_superadmin === true ? user : null
}

// ── GET /api/admin/plans ─────────────────────────────────────────────────────
export async function GET() {
  const user = await assertSuperadmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("pricing_plans")
    .select("*")
    .order("sort_order")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans: data })
}
