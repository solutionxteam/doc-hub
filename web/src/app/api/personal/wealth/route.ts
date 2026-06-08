/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET — aggregate personal spending from documents where is_personal=true OR user_id=current_user
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const thisYear  = now.getFullYear()
  const thisMonth = now.getMonth() + 1 // 1-based

  // Fetch last 6 months of personal documents for series + categories
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: docs, error } = await supabase
    .from("documents")
    .select("total_amount, doc_category, doc_date")
    .eq("user_id", user.id)
    .eq("is_personal", true)
    .gte("doc_date", sixMonthsAgo.toISOString().slice(0, 10))
    .not("total_amount", "is", null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = docs ?? []

  // Build monthly series (last 6 months)
  const monthMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthMap[key] = 0
  }

  // Category accumulator
  const categoryMap: Record<string, number> = {}

  let monthSpend     = 0
  let prevMonthSpend = 0
  let totalThisYear  = 0

  const prevMonth      = thisMonth === 1 ? 12 : thisMonth - 1
  const prevMonthYear  = thisMonth === 1 ? thisYear - 1 : thisYear

  for (const doc of rows) {
    const amount = Number(doc.total_amount ?? 0)
    if (!doc.doc_date) continue

    const date     = new Date(doc.doc_date)
    const yr       = date.getFullYear()
    const mo       = date.getMonth() + 1
    const monthKey = `${yr}-${String(mo).padStart(2, "0")}`

    // Monthly series
    if (monthMap[monthKey] !== undefined) {
      monthMap[monthKey] += amount
    }

    // This month
    if (yr === thisYear && mo === thisMonth) {
      monthSpend += amount
    }

    // Prev month
    if (yr === prevMonthYear && mo === prevMonth) {
      prevMonthSpend += amount
    }

    // This year
    if (yr === thisYear) {
      totalThisYear += amount
    }

    // Categories
    const cat = (doc.doc_category as string | null) ?? "other"
    categoryMap[cat] = (categoryMap[cat] ?? 0) + amount
  }

  // Top 5 categories
  const categories = Object.entries(categoryMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))

  // Monthly series as array
  const monthlySeries = Object.entries(monthMap).map(([month, total]) => ({
    month,
    total: Math.round(total * 100) / 100,
  }))

  return NextResponse.json({
    monthSpend:     Math.round(monthSpend * 100) / 100,
    prevMonthSpend: Math.round(prevMonthSpend * 100) / 100,
    monthlySeries,
    categories,
    totalThisYear:  Math.round(totalThisYear * 100) / 100,
  })
}
