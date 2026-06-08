/**
 * POST /api/admin/config
 * Superadmin-only: update a system_config value
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { createAdminClient }         from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  // Auth: must be superadmin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_superadmin) {
    return NextResponse.json({ error: "Forbidden — superadmin only" }, { status: 403 })
  }

  const { key, value } = await req.json() as { key: string; value: unknown }
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from("system_config")
    .update({ value, updated_by: user.id })
    .eq("key", key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also sync org_quota columns in pricing_plans for the plan-quota keys
  const planQuotaMap: Record<string, string> = {
    free_plan_org_quota:     "free",
    starter_plan_org_quota:  "starter",
    personal_plan_org_quota: "personal",
  }
  if (planQuotaMap[key]) {
    await admin
      .from("pricing_plans")
      .update({ org_quota: Number(value) })
      .eq("id", planQuotaMap[key])
  }

  return NextResponse.json({ ok: true })
}
