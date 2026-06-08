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
import { getDocQuota, getOrgQuota } from "@/lib/plans"

export async function POST(req: NextRequest) {
  // ── 1. Verify caller is authenticated (anon client reads session cookie) ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── 2. Parse + validate body ─────────────────────────────────────────────
  const body = await req.json() as {
    fullName:      string
    orgName:       string
    taxId:         string
    address:       string
    fiscalYearEnd: number
    accountType?:  "business" | "personal"
  }

  const { fullName, orgName, taxId, address, fiscalYearEnd, accountType = "business" } = body

  if (!fullName?.trim())  return NextResponse.json({ error: "ชื่อ-นามสกุล จำเป็น" },   { status: 400 })
  if (!orgName?.trim())   return NextResponse.json({ error: "ชื่อองค์กร จำเป็น" },       { status: 400 })
  if (!fiscalYearEnd)     return NextResponse.json({ error: "เดือนสิ้นปีบัญชี จำเป็น" }, { status: 400 })
  if (accountType === "business") {
    if (!taxId?.trim())   return NextResponse.json({ error: "เลขผู้เสียภาษี จำเป็น" },   { status: 400 })
    if (!address?.trim()) return NextResponse.json({ error: "ที่อยู่ จำเป็น" },           { status: 400 })
  }

  // ── 3. All writes via admin client (bypasses RLS) ────────────────────────
  const admin = createAdminClient()

  // ── 3-pre. Check org quota for this user ──────────────────────────────────
  // Count how many orgs this user already owns
  const { count: ownedCount } = await admin
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "owner")

  // Get user's plan from their first org (or default to free)
  const { data: firstMembership } = await admin
    .from("organization_members")
    .select("organizations(plan)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .limit(1)
    .single()

  const userPlan = (firstMembership?.organizations as any)?.plan ?? "free"
  const orgQuota = getOrgQuota(userPlan)
  const owned    = ownedCount ?? 0

  if (orgQuota > 0 && owned >= orgQuota) {
    return NextResponse.json({
      error: `แผน ${userPlan.toUpperCase()} สร้างได้สูงสุด ${orgQuota} องค์กร (ตอนนี้มี ${owned} แล้ว) · อัปเกรดแผนเพื่อสร้างเพิ่ม`,
      code:  "ORG_QUOTA_EXCEEDED",
      quota: orgQuota,
      owned,
    }, { status: 403 })
  }

  // 3a. Upsert user profile
  const { error: profileError } = await admin
    .from("users")
    .upsert(
      { id: user.id, full_name: fullName.trim(), email: user.email },
      { onConflict: "id" }
    )

  if (profileError) {
    console.error("profile upsert:", profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // 3b. Create organization
  const slug = slugify(orgName.trim()) + "-" + Date.now().toString(36)
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name:            orgName.trim(),
      slug,
      account_type:    accountType,          // 'business' | 'personal'
      tax_id:          taxId?.trim() || null,
      address:         address?.trim() || null,
      fiscal_year_end: fiscalYearEnd,
      plan:            "free",
      doc_quota:       getDocQuota("free"),
      doc_used:        0,
    })
    .select("id")
    .single()

  if (orgError || !org) {
    console.error("org create:", orgError)
    return NextResponse.json({ error: orgError?.message ?? "สร้างองค์กรไม่สำเร็จ" }, { status: 500 })
  }

  // 3c. Add user as owner
  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" })

  if (memberError) {
    // Roll back: delete the org we just created
    await admin.from("organizations").delete().eq("id", org.id)
    console.error("member insert:", memberError)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
