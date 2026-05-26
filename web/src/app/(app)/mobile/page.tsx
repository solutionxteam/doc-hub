/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getMembership } from "@/lib/get-membership"
import { createClient }  from "@/lib/supabase/server"
import { MobileClient }  from "@/components/mobile/mobile-client"

const CATEGORY_COLORS = [
  "#6366f1","#8b5cf6","#06b6d4","#10b981",
  "#f97316","#f59e0b","#e11d48","#0ea5e9",
]

export default async function MobilePage() {
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const now           = new Date()
  const thisYear      = now.getFullYear()
  const thisMonth     = now.getMonth()       // 0-indexed
  const eightMonthsAgo = new Date(thisYear, thisMonth - 7, 1).toISOString()
  const thisMonthStart = new Date(thisYear, thisMonth, 1).toISOString()
  const prevMonthStart = new Date(thisYear, thisMonth - 1, 1).toISOString()
  const thisMonthEnd   = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59).toISOString()
  const prevMonthEnd   = new Date(thisYear, thisMonth, 0, 23, 59, 59).toISOString()

  const [
    { data: org },
    { count: totalDocs },
    { count: pendingDocs },
    { data: monthlyRaw },
    { data: thisMonthDocs },
    { data: prevMonthDocs },
    { data: categoryDocs },
  ] = await Promise.all([
    supabase.from("organizations").select("name, plan").eq("id", orgId).single(),

    // Total docs
    supabase.from("documents").select("id", { count:"exact", head:true })
      .eq("organization_id", orgId)
      .in("status", ["approved","reviewing","pushed","pending"]),

    // Pending/reviewing
    supabase.from("documents").select("id", { count:"exact", head:true })
      .eq("organization_id", orgId)
      .in("status", ["pending","reviewing"]),

    // Monthly totals — last 8 months (for chart)
    supabase.from("documents").select("doc_date, total_amount")
      .eq("organization_id", orgId)
      .in("status", ["approved","pushed"])
      .gte("doc_date", eightMonthsAgo)
      .not("total_amount", "is", null),

    // This month spend
    supabase.from("documents").select("total_amount")
      .eq("organization_id", orgId)
      .in("status", ["approved","pushed"])
      .gte("doc_date", thisMonthStart).lte("doc_date", thisMonthEnd)
      .not("total_amount", "is", null),

    // Previous month spend (for MoM delta)
    supabase.from("documents").select("total_amount")
      .eq("organization_id", orgId)
      .in("status", ["approved","pushed"])
      .gte("doc_date", prevMonthStart).lte("doc_date", prevMonthEnd)
      .not("total_amount", "is", null),

    // Category breakdown (this year)
    supabase.from("documents").select("doc_category, total_amount")
      .eq("organization_id", orgId)
      .in("status", ["approved","pushed"])
      .gte("doc_date", `${thisYear}-01-01`).lte("doc_date", `${thisYear}-12-31`)
      .not("total_amount", "is", null),
  ])

  /* ── Monthly series (last 8 months) ── */
  const monthLabels: { key: string; label: string }[] = []
  const monthMap = new Map<string, number>()
  for (let i = 7; i >= 0; i--) {
    const d     = new Date(thisYear, thisMonth - i, 1)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("th-TH", { month: "short" })
    monthLabels.push({ key, label })
    monthMap.set(key, 0)
  }
  for (const doc of monthlyRaw ?? []) {
    if (!doc.doc_date) continue
    const key = doc.doc_date.slice(0, 7)  // "YYYY-MM"
    if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + Number(doc.total_amount))
  }
  const monthlySeries = monthLabels.map(({ key, label }) => ({
    m:     label,
    spend: Math.round(monthMap.get(key) ?? 0),
  }))

  /* ── KPIs ── */
  const monthSpend     = (thisMonthDocs ?? []).reduce((s, d) => s + Number(d.total_amount), 0)
  const prevMonthSpend = (prevMonthDocs ?? []).reduce((s, d) => s + Number(d.total_amount), 0)

  /* ── Categories ── */
  const catMap = new Map<string, number>()
  for (const doc of categoryDocs ?? []) {
    const key = doc.doc_category ?? "อื่นๆ"
    catMap.set(key, (catMap.get(key) ?? 0) + Number(doc.total_amount))
  }
  // Sort by value desc, take top 5
  const categories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], i) => ({
      name,
      value: Math.round(value),
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))

  return (
    <MobileClient
      orgName={org?.name ?? "—"}
      orgPlan={org?.plan ?? "free"}
      orgRole={role}
      totalDocs={totalDocs ?? 0}
      pendingDocs={pendingDocs ?? 0}
      monthSpend={Math.round(monthSpend)}
      prevMonthSpend={Math.round(prevMonthSpend)}
      monthlySeries={monthlySeries}
      categories={categories}
    />
  )
}
