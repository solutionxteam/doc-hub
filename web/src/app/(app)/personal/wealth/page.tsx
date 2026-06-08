/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient } from "@/lib/supabase/server"
import { WealthClient } from "@/components/personal/wealth-client"

export const dynamic = "force-dynamic"

export interface WealthDoc {
  id:              string
  vendor_name:     string | null
  total_amount:    number
  document_date:   string
  health_category: string | null
}

export interface WealthSeries {
  label: string
  value: number
}

export interface WealthCategory {
  name:  string
  total: number
}

export default async function WealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ""

  const now           = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
  const yearStart      = new Date(now.getFullYear(), 0, 1).toISOString()

  // Monthly series — last 6 months
  const monthlySeries: WealthSeries[] = []
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString()
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59).toISOString()
    const label = new Date(now.getFullYear(), now.getMonth() - i, 1)
      .toLocaleDateString("th-TH", { month: "short" })
    const { data } = await supabase
      .from("documents")
      .select("total_amount")
      .eq("user_id", userId)
      .eq("is_personal", true)
      .gte("document_date", start)
      .lte("document_date", end)
    const total = (data ?? []).reduce((s, d) => s + Number(d.total_amount ?? 0), 0)
    monthlySeries.push({ label, value: total })
  }

  // This month spend
  const { data: thisMonthDocs } = await supabase
    .from("documents")
    .select("total_amount")
    .eq("user_id", userId)
    .eq("is_personal", true)
    .gte("document_date", thisMonthStart)
  const monthSpend = (thisMonthDocs ?? []).reduce((s, d) => s + Number(d.total_amount ?? 0), 0)

  // Prev month spend
  const { data: prevDocs } = await supabase
    .from("documents")
    .select("total_amount")
    .eq("user_id", userId)
    .eq("is_personal", true)
    .gte("document_date", lastMonthStart)
    .lte("document_date", lastMonthEnd)
  const prevMonthSpend = (prevDocs ?? []).reduce((s, d) => s + Number(d.total_amount ?? 0), 0)

  // Year total
  const { data: yearDocs } = await supabase
    .from("documents")
    .select("total_amount")
    .eq("user_id", userId)
    .eq("is_personal", true)
    .gte("document_date", yearStart)
  const totalThisYear = (yearDocs ?? []).reduce((s, d) => s + Number(d.total_amount ?? 0), 0)

  // Category breakdown from this month
  const { data: catDocs } = await supabase
    .from("documents")
    .select("health_category, total_amount")
    .eq("user_id", userId)
    .eq("is_personal", true)
    .gte("document_date", thisMonthStart)

  const catMap: Record<string, number> = {}
  for (const d of catDocs ?? []) {
    const key = d.health_category ?? "อื่นๆ"
    catMap[key] = (catMap[key] ?? 0) + Number(d.total_amount ?? 0)
  }
  const categories: WealthCategory[] = Object.entries(catMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Recent personal docs
  const { data: recentDocs } = await supabase
    .from("documents")
    .select("id, vendor_name, total_amount, document_date, health_category")
    .eq("user_id", userId)
    .eq("is_personal", true)
    .order("document_date", { ascending: false })
    .limit(10)

  return (
    <WealthClient
      monthSpend={monthSpend}
      prevMonthSpend={prevMonthSpend}
      monthlySeries={monthlySeries}
      categories={categories}
      totalThisYear={totalThisYear}
      recentDocs={(recentDocs ?? []) as WealthDoc[]}
    />
  )
}
