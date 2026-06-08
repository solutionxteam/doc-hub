/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * /personal/vita — Vita Score Card + share to Vita Community
 */

import { createClient }    from "@/lib/supabase/server"
import { VitaCardClient }  from "@/components/personal/vita-card-client"
import { computeVitaScores, type HealthAverages, type LifestyleStats, type FinancialStats } from "@/lib/vita-scores"

export const dynamic = "force-dynamic"

export default async function VitaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ""

  const now       = new Date()
  const since30d  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since90d  = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: profile },
    { data: healthRows },
    { count: weightEntries },
    { data: docRows },
    { data: docs90 },
    { data: docsMonth },
    { data: goals },
    { data: subs },
    { data: snapshots },
  ] = await Promise.all([
    supabase
      .from("personal_profiles")
      .select("display_name, bio, longevity_score, wealth_score, is_public, follower_count")
      .eq("user_id", uid)
      .maybeSingle(),
    supabase
      .from("health_entries")
      .select("type, value")
      .eq("user_id", uid)
      .gte("recorded_at", since30d),
    supabase
      .from("health_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("type", "weight")
      .gte("recorded_at", since90d),
    supabase
      .from("documents")
      .select("health_category")
      .eq("user_id", uid)
      .eq("is_personal", true)
      .gte("created_at", since30d),
    supabase
      .from("documents")
      .select("total_amount")
      .eq("user_id", uid)
      .eq("is_personal", true)
      .gte("created_at", since90d),
    supabase
      .from("documents")
      .select("total_amount")
      .eq("user_id", uid)
      .eq("is_personal", true)
      .gte("created_at", monthStart),
    supabase
      .from("financial_goals")
      .select("target_amount, current_amount")
      .eq("user_id", uid)
      .eq("status", "active"),
    supabase
      .from("detected_subscriptions")
      .select("is_confirmed")
      .eq("user_id", uid),
    supabase
      .from("score_snapshots")
      .select("snapshot_date, longevity_score, wealth_score")
      .eq("user_id", uid)
      .order("snapshot_date", { ascending: true })
      .limit(30),
  ])

  // Build input structs
  const avg = (type: string) => {
    const vals = (healthRows ?? []).filter(r => r.type === type).map(r => Number(r.value))
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }
  const countCat = (cats: string[]) =>
    (docRows ?? []).filter(r => cats.includes(r.health_category ?? "")).length
  const sumAmounts = (rows: { total_amount: number | null }[]) =>
    (rows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0)
  const goalPct = goals?.length
    ? (goals.reduce((s, g) => s + Math.min(Number(g.current_amount) / Number(g.target_amount || 1), 1), 0)
       / goals.length) * 100
    : 0

  const health: HealthAverages = {
    steps:         avg("steps"),
    sleep:         avg("sleep_hours"),
    heartRate:     avg("heart_rate"),
    hrv:           avg("hrv"),
    sysBP:         avg("blood_pressure_systolic"),
    diaBP:         avg("blood_pressure_diastolic"),
    glucose:       avg("blood_glucose"),
    waterMl:       avg("water_ml"),
    entryCount:    (healthRows ?? []).length,
    weightEntries: weightEntries ?? 0,
  }
  const lifestyle: LifestyleStats = {
    healthyFoodCount:   countCat(["food_healthy"]),
    unhealthyFoodCount: countCat(["food_unhealthy"]),
    fitnessCount:       countCat(["fitness"]),
    supplementCount:    countCat(["supplement", "wellness", "medical"]),
    alcoholCount:       countCat(["alcohol", "caffeine"]),
    totalPersonalDocs:  (docRows ?? []).length,
  }
  const finance: FinancialStats = {
    avgMonthlySpend:   sumAmounts(docs90 as any ?? []) / 3,
    currMonthSpend:    sumAmounts(docsMonth as any ?? []),
    goalCompletionPct: goalPct,
    activeGoals:       goals?.length ?? 0,
    confirmedSubs:     (subs ?? []).filter(s => s.is_confirmed).length,
    totalSubs:         (subs ?? []).length,
  }

  const scores = computeVitaScores(health, lifestyle, finance)

  return (
    <VitaCardClient
      scores={scores}
      profile={profile ?? null}
      history={(snapshots ?? []) as { snapshot_date: string; longevity_score: number; wealth_score: number }[]}
    />
  )
}
