/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getMembership }   from "@/lib/get-membership"
import { createClient }    from "@/lib/supabase/server"
import { AnalyticsClient } from "@/components/analytics/analytics-client"

export default async function AnalyticsPage() {
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  const currentYear = new Date().getFullYear()

  // 12-month summary from view
  const { data: monthly } = await supabase
    .from("monthly_expense_summary")
    .select("*")
    .eq("organization_id", orgId)
    .order("month", { ascending: true })
    .limit(12)

  // Top vendors (last 3 months)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: topVendors } = await supabase.rpc("get_top_vendors", {
    p_org_id:    orgId,
    p_date_from: threeMonthsAgo.toISOString().split("T")[0],
    p_date_to:   new Date().toISOString().split("T")[0],
    p_limit:     10,
  })

  // Category breakdown for current year (aggregate server-side from documents)
  const { data: categoryDocs } = await supabase
    .from("documents")
    .select("doc_category, total_amount")
    .eq("organization_id", orgId)
    .in("status", ["approved", "pushed"])
    .gte("doc_date", `${currentYear}-01-01`)
    .lte("doc_date", `${currentYear}-12-31`)
    .not("total_amount", "is", null)

  // Aggregate by category
  const categoryMap = new Map<string, number>()
  for (const doc of categoryDocs ?? []) {
    const key = doc.doc_category ?? "อื่นๆ"
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + (Number(doc.total_amount) ?? 0))
  }
  const categories = [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }))

  return (
    <AnalyticsClient
      monthly={monthly ?? []}
      topVendors={topVendors ?? []}
      categories={categories}
    />
  )
}
