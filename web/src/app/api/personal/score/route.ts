/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * POST /api/personal/score — compute & persist Vita scores, return full breakdown
 * GET  /api/personal/score — return latest stored scores + 30-day history
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import {
  computeVitaScores,
  type HealthAverages,
  type LifestyleStats,
  type FinancialStats,
} from "@/lib/vita-scores"

// ── GET ── return latest scores + 30-day snapshot history ──────────────────
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [{ data: profile }, { data: snapshots }] = await Promise.all([
    supabase
      .from("personal_profiles")
      .select("longevity_score, wealth_score")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("score_snapshots")
      .select("snapshot_date, longevity_score, wealth_score, longevity_physical, longevity_metabolic, longevity_lifestyle, longevity_financial, wealth_discipline, wealth_goals, wealth_subscriptions, wealth_health_invest, wealth_consistency")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: false })
      .limit(30),
  ])

  return NextResponse.json({
    longevityScore: profile?.longevity_score ?? 0,
    wealthScore:    profile?.wealth_score    ?? 0,
    history:        snapshots ?? [],
  })
}

// ── POST ── recompute scores from current data ──────────────────────────────
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const uid         = user.id
  const now         = new Date()
  const since30d    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since90d    = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // ── Fetch health entries ─────────────────────────────────────────────────
  const { data: healthRows } = await supabase
    .from("health_entries")
    .select("type, value")
    .eq("user_id", uid)
    .gte("recorded_at", since30d)

  const { count: weightEntries } = await supabase
    .from("health_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("type", "weight")
    .gte("recorded_at", since90d)

  const avg = (type: string) => {
    const vals = (healthRows ?? []).filter(r => r.type === type).map(r => Number(r.value))
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

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

  // ── Fetch lifestyle receipts ─────────────────────────────────────────────
  const { data: docRows } = await supabase
    .from("documents")
    .select("health_category")
    .eq("user_id", uid)
    .eq("is_personal", true)
    .gte("created_at", since30d)

  const countCat = (cats: string[]) =>
    (docRows ?? []).filter(r => cats.includes(r.health_category ?? "")).length

  const lifestyle: LifestyleStats = {
    healthyFoodCount:   countCat(["food_healthy"]),
    unhealthyFoodCount: countCat(["food_unhealthy"]),
    fitnessCount:       countCat(["fitness"]),
    supplementCount:    countCat(["supplement", "wellness", "medical"]),
    alcoholCount:       countCat(["alcohol", "caffeine"]),
    totalPersonalDocs:  (docRows ?? []).length,
  }

  // ── Fetch financial stats ─────────────────────────────────────────────────
  const { data: docs90 } = await supabase
    .from("documents")
    .select("total_amount")
    .eq("user_id", uid)
    .eq("is_personal", true)
    .gte("created_at", since90d)

  const { data: docsMonth } = await supabase
    .from("documents")
    .select("total_amount")
    .eq("user_id", uid)
    .eq("is_personal", true)
    .gte("created_at", monthStart)

  const { data: goals } = await supabase
    .from("financial_goals")
    .select("target_amount, current_amount")
    .eq("user_id", uid)
    .eq("status", "active")

  const { data: subs } = await supabase
    .from("detected_subscriptions")
    .select("is_confirmed")
    .eq("user_id", uid)

  const sumAmounts = (rows: { total_amount: number }[]) =>
    (rows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0)

  const goalCompletionPct = goals && goals.length
    ? (goals.reduce((s, g) => s + Math.min(Number(g.current_amount) / Number(g.target_amount || 1), 1), 0)
       / goals.length) * 100
    : 0

  const finance: FinancialStats = {
    avgMonthlySpend:   sumAmounts(docs90 as any ?? []) / 3,
    currMonthSpend:    sumAmounts(docsMonth as any ?? []),
    goalCompletionPct,
    activeGoals:       goals?.length ?? 0,
    confirmedSubs:     (subs ?? []).filter(s => s.is_confirmed).length,
    totalSubs:         (subs ?? []).length,
  }

  // ── Compute ──────────────────────────────────────────────────────────────
  const scores = computeVitaScores(health, lifestyle, finance)

  // ── Persist ──────────────────────────────────────────────────────────────
  const today = now.toISOString().slice(0, 10)

  await Promise.all([
    // Update personal_profiles
    supabase
      .from("personal_profiles")
      .upsert({
        user_id:         uid,
        longevity_score: scores.longevityScore,
        wealth_score:    scores.wealthScore,
        updated_at:      now.toISOString(),
      }),
    // Upsert today's snapshot
    supabase
      .from("score_snapshots")
      .upsert({
        user_id:              uid,
        snapshot_date:        today,
        longevity_score:      scores.longevityScore,
        wealth_score:         scores.wealthScore,
        longevity_physical:   scores.longevity.physical,
        longevity_metabolic:  scores.longevity.metabolic,
        longevity_lifestyle:  scores.longevity.lifestyle,
        longevity_financial:  scores.longevity.financial,
        wealth_discipline:    scores.wealth.discipline,
        wealth_goals:         scores.wealth.goals,
        wealth_subscriptions: scores.wealth.subscriptions,
        wealth_health_invest: scores.wealth.healthInvest,
        wealth_consistency:   scores.wealth.consistency,
      }),
  ])

  return NextResponse.json({ ok: true, scores })
}
