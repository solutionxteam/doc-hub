/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient } from "@/lib/supabase/server"
import { HealthClient } from "@/components/personal/health-client"

export const dynamic = "force-dynamic"

export interface HealthEntry {
  id:          string
  type:        string
  value:       number
  unit:        string
  notes:       string | null
  recorded_at: string
}

export default async function HealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ""

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: entries } = await supabase
    .from("health_entries")
    .select("id, type, value, unit, notes, recorded_at")
    .eq("user_id", userId)
    .gte("recorded_at", thirtyDaysAgo)
    .order("recorded_at", { ascending: false })
    .limit(50)

  const { data: profile } = await supabase
    .from("personal_profiles")
    .select("longevity_score")
    .eq("user_id", userId)
    .single()

  const longevityScore = profile?.longevity_score ?? 0

  return (
    <HealthClient
      entries={(entries ?? []) as HealthEntry[]}
      longevityScore={longevityScore}
    />
  )
}
