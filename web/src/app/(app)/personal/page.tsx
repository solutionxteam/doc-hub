/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient } from "@/lib/supabase/server"
import { PersonalOverviewClient } from "@/components/personal/personal-overview-client"

export const dynamic = "force-dynamic"

export default async function PersonalPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ""

  // Fetch personal profile
  const { data: profile } = await supabase
    .from("personal_profiles")
    .select("display_name, bio, longevity_score, wealth_score, is_public, follower_count, following_count")
    .eq("user_id", userId)
    .single()

  // Monthly spend: current month vs last month (personal documents)
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

  const { data: thisMonthDocs } = await supabase
    .from("documents")
    .select("total_amount")
    .eq("user_id", userId)
    .eq("is_personal", true)
    .gte("document_date", thisMonthStart)

  const { data: lastMonthDocs } = await supabase
    .from("documents")
    .select("total_amount")
    .eq("user_id", userId)
    .eq("is_personal", true)
    .gte("document_date", lastMonthStart)
    .lte("document_date", lastMonthEnd)

  const thisMonthSpend = (thisMonthDocs ?? []).reduce(
    (sum, d) => sum + Number(d.total_amount ?? 0), 0
  )
  const lastMonthSpend = (lastMonthDocs ?? []).reduce(
    (sum, d) => sum + Number(d.total_amount ?? 0), 0
  )

  // Health entries count for last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: healthCount } = await supabase
    .from("health_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("recorded_at", thirtyDaysAgo)

  // Active financial goals count
  const { count: activeGoalsCount } = await supabase
    .from("financial_goals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")

  // Unconfirmed subscriptions count
  const { count: pendingSubsCount } = await supabase
    .from("detected_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_confirmed", false)

  return (
    <PersonalOverviewClient
      profile={profile ?? null}
      thisMonthSpend={thisMonthSpend}
      lastMonthSpend={lastMonthSpend}
      healthEntriesCount={healthCount ?? 0}
      activeGoalsCount={activeGoalsCount ?? 0}
      pendingSubsCount={pendingSubsCount ?? 0}
    />
  )
}
