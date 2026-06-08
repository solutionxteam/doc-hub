/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient } from "@/lib/supabase/server"
import { PlannerClient } from "@/components/personal/planner-client"

export const dynamic = "force-dynamic"

export interface FinancialGoal {
  id:             string
  name:           string
  category:       string | null
  target_amount:  number
  current_amount: number
  deadline:       string | null
  status:         string
}

export interface DetectedSubscription {
  id:               string
  vendor_name:      string
  estimated_amount: number
  frequency:        string
  next_due_date:    string | null
  is_confirmed:     boolean
}

export default async function PlannerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ""

  const { data: goals } = await supabase
    .from("financial_goals")
    .select("id, name, category, target_amount, current_amount, deadline, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  const { data: subscriptions } = await supabase
    .from("detected_subscriptions")
    .select("id, vendor_name, estimated_amount, frequency, next_due_date, is_confirmed")
    .eq("user_id", userId)
    .order("next_due_date", { ascending: true })

  return (
    <PlannerClient
      goals={(goals ?? []) as FinancialGoal[]}
      subscriptions={(subscriptions ?? []) as DetectedSubscription[]}
    />
  )
}
