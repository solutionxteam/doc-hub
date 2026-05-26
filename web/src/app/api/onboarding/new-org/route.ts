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
import { slugify }           from "@/lib/utils"
import { getDocQuota }       from "@/lib/plans"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgName, taxId, address, fiscalYearEnd, accountType } = await req.json() as {
    orgName: string; taxId: string; address: string
    fiscalYearEnd: number; accountType: "business" | "personal"
  }

  if (!orgName?.trim()) return NextResponse.json({ error: "ชื่อองค์กรจำเป็น" }, { status: 400 })
  if (accountType === "business") {
    if (!taxId?.trim())   return NextResponse.json({ error: "เลขผู้เสียภาษีจำเป็น" }, { status: 400 })
    if (!address?.trim()) return NextResponse.json({ error: "ที่อยู่จำเป็น" }, { status: 400 })
  }

  const admin = createAdminClient()
  const slug  = slugify(orgName.trim()) + "-" + Date.now().toString(36)

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name:            orgName.trim(),
      slug,
      tax_id:          taxId?.trim() || null,
      address:         address?.trim() || null,
      fiscal_year_end: fiscalYearEnd ?? 12,
      plan:            "free",
      doc_quota:       getDocQuota("free"),
      doc_used:        0,
    })
    .select("id")
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message ?? "สร้างองค์กรไม่สำเร็จ" }, { status: 500 })
  }

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" })

  if (memberError) {
    await admin.from("organizations").delete().eq("id", org.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, orgId: org.id })
}
