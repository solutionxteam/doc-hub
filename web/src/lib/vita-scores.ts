/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * Vita Scoring Model — server-side TypeScript implementation
 * Mirrors the Postgres function in 018_vita_scores.sql.
 *
 * Longevity Score (0–100): Physical + Metabolic + Lifestyle + Financial stress
 * Wealth Score    (0–100): Discipline + Goals + Subscriptions + Health invest + Consistency
 *
 * The two scores are BIDIRECTIONALLY linked:
 *   • Wealth Score (financial stress) feeds into Longevity (c_financial component)
 *   • Lifestyle receipts (health invest) feed into both Lifestyle AND Wealth components
 */

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface HealthAverages {
  /** Average daily steps (last 30d) */
  steps:     number
  /** Average sleep hours (last 30d) */
  sleep:     number
  /** Resting heart rate bpm (last 30d) */
  heartRate: number
  /** Heart rate variability ms (last 30d) */
  hrv:       number
  /** Systolic blood pressure (last 30d) */
  sysBP:     number
  /** Diastolic blood pressure (last 30d) */
  diaBP:     number
  /** Fasting blood glucose mg/dL (last 30d) */
  glucose:   number
  /** Average daily water intake ml (last 30d) */
  waterMl:   number
  /** Total health entries in last 30d */
  entryCount: number
  /** Weight entries in last 90d (tracking consistency) */
  weightEntries: number
}

export interface LifestyleStats {
  /** Receipts tagged food_healthy (last 30d) */
  healthyFoodCount:   number
  /** Receipts tagged food_unhealthy (last 30d) */
  unhealthyFoodCount: number
  /** Receipts tagged fitness (last 30d) */
  fitnessCount:       number
  /** Receipts tagged supplement/wellness/medical (last 30d) */
  supplementCount:    number
  /** Receipts tagged alcohol/caffeine (last 30d) */
  alcoholCount:       number
  /** Total personal receipts (last 30d) */
  totalPersonalDocs:  number
}

export interface FinancialStats {
  /** 3-month average monthly personal spend */
  avgMonthlySpend:   number
  /** Current month personal spend */
  currMonthSpend:    number
  /** Average goal completion 0–100 */
  goalCompletionPct: number
  /** Number of active financial goals */
  activeGoals:       number
  /** Confirmed subscriptions */
  confirmedSubs:     number
  /** Total detected subscriptions */
  totalSubs:         number
}

// ─── Score Components ─────────────────────────────────────────────────────────

export interface LongevityComponents {
  /** Physical health (steps, sleep, HR, HRV, BP) — max 40 */
  physical:   number
  /** Metabolic health (glucose, weight tracking) — max 20 */
  metabolic:  number
  /** Lifestyle quality from receipts (food, fitness, water) — max 25 */
  lifestyle:  number
  /** Financial health connection (wealth score → stress → longevity) — max 15 */
  financial:  number
}

export interface WealthComponents {
  /** Spending discipline & healthy spend ratio — max 30 */
  discipline:    number
  /** Financial goals progress — max 25 */
  goals:         number
  /** Subscription awareness — max 15 */
  subscriptions: number
  /** Health investment ratio — max 15 */
  healthInvest:  number
  /** Data recording consistency — max 15 */
  consistency:   number
}

export interface VitaScores {
  longevityScore: number
  wealthScore:    number
  longevity:      LongevityComponents
  wealth:         WealthComponents
  /** Grade label: S/A/B/C/D */
  longevityGrade: "S" | "A" | "B" | "C" | "D"
  wealthGrade:    "S" | "A" | "B" | "C" | "D"
  /** Qualitative insights (3 items each) */
  longevityInsights: string[]
  wealthInsights:    string[]
}

// ─── Grade Helper ─────────────────────────────────────────────────────────────

function grade(score: number): "S" | "A" | "B" | "C" | "D" {
  if (score >= 90) return "S"
  if (score >= 75) return "A"
  if (score >= 55) return "B"
  if (score >= 35) return "C"
  return "D"
}

// ─── Core Computation ─────────────────────────────────────────────────────────

export function computeVitaScores(
  health:    HealthAverages,
  lifestyle: LifestyleStats,
  finance:   FinancialStats,
): VitaScores {

  // ── WEALTH SCORE (compute first — feeds longevity) ───────────────────────

  // 1. Spending Discipline (max 30)
  let cDiscipline = 0
  if (finance.avgMonthlySpend > 0) {
    const spendRatio = finance.currMonthSpend / finance.avgMonthlySpend
    cDiscipline +=
      spendRatio >= 0.8 && spendRatio <= 1.1 ? 15 :
      spendRatio >= 0.7 && spendRatio <= 1.2 ? 10 :
      spendRatio >= 0.5 && spendRatio <= 1.3 ? 5  : 0
  }
  const healthSpendRatio =
    lifestyle.totalPersonalDocs > 0
      ? (lifestyle.healthyFoodCount + lifestyle.fitnessCount + lifestyle.supplementCount)
        / lifestyle.totalPersonalDocs
      : 0
  cDiscipline += Math.min(healthSpendRatio * 15, 15)

  // 2. Goals Progress (max 25)
  let cGoals = Math.min(finance.goalCompletionPct * 0.15, 15)
  cGoals +=
    finance.activeGoals >= 1 && finance.activeGoals <= 5 ? 10 :
    finance.activeGoals > 5  ? 7 : 0

  // 3. Subscription Awareness (max 15)
  let cSubs = 0
  if (finance.totalSubs === 0) {
    cSubs = 10 // clean slate
  } else {
    cSubs = Math.min((finance.confirmedSubs / finance.totalSubs) * 10, 10)
  }
  cSubs +=
    finance.totalSubs <= 3  ? 5 :
    finance.totalSubs <= 6  ? 3 :
    finance.totalSubs <= 10 ? 1 : 0

  // 4. Health Investment (max 15)
  const cHealthInvest = Math.min(healthSpendRatio * 15, 15)

  // 5. Consistency (max 15)
  let cConsistency = 0
  cConsistency +=
    health.entryCount >= 30 ? 8 :
    health.entryCount >= 15 ? 5 :
    health.entryCount >= 7  ? 3 :
    health.entryCount >= 1  ? 1 : 0
  cConsistency +=
    lifestyle.totalPersonalDocs >= 20 ? 7 :
    lifestyle.totalPersonalDocs >= 10 ? 5 :
    lifestyle.totalPersonalDocs >= 5  ? 3 :
    lifestyle.totalPersonalDocs >= 1  ? 1 : 0

  const wealthScore = Math.min(
    Math.round(cDiscipline + cGoals + cSubs + cHealthInvest + cConsistency),
    100
  )

  // ── LONGEVITY SCORE ──────────────────────────────────────────────────────

  // 1. Physical Health (max 40)
  let cPhysical = 0

  // Steps
  cPhysical +=
    health.steps >= 10000 ? 10 :
    health.steps >= 7500  ? 7  :
    health.steps >= 5000  ? 5  :
    health.steps >= 3000  ? 2  : 0

  // Sleep
  cPhysical +=
    health.sleep >= 7 && health.sleep <= 9   ? 10 :
    health.sleep >= 6 && health.sleep <= 9.9 ? 7  :
    health.sleep >= 5 && health.sleep <  6   ? 4  :
    health.sleep > 0                         ? 1  : 0

  // Resting heart rate
  cPhysical +=
    health.heartRate >= 50 && health.heartRate <= 70 ? 10 :
    health.heartRate >= 70 && health.heartRate <= 80 ? 7  :
    health.heartRate >= 80 && health.heartRate <= 90 ? 4  :
    health.heartRate > 0                             ? 1  : 0

  // HRV
  cPhysical +=
    health.hrv >= 60 ? 5 :
    health.hrv >= 40 ? 3 :
    health.hrv >= 20 ? 1 : 0

  // Blood pressure
  cPhysical +=
    health.sysBP >= 90  && health.sysBP <= 120 && health.diaBP >= 60 && health.diaBP <= 80 ? 5 :
    health.sysBP >= 90  && health.sysBP <= 130 && health.diaBP >= 60 && health.diaBP <= 85 ? 3 :
    health.sysBP > 0 ? 1 : 0

  // 2. Metabolic Health (max 20)
  let cMetabolic = 0

  // Blood glucose
  cMetabolic +=
    health.glucose >= 70  && health.glucose <= 100 ? 10 :
    health.glucose > 100  && health.glucose <= 110 ? 6  :
    health.glucose > 110  && health.glucose <= 125 ? 3  :
    health.glucose > 0                             ? 1  : 0

  // Weight tracking consistency
  cMetabolic +=
    health.weightEntries >= 8 ? 10 :
    health.weightEntries >= 4 ? 7  :
    health.weightEntries >= 1 ? 4  : 0

  // 3. Lifestyle Quality (max 25)
  let cLifestyle = 0

  // Healthy food ratio
  const totalFoodDocs = lifestyle.healthyFoodCount + lifestyle.unhealthyFoodCount
  if (totalFoodDocs > 0) {
    cLifestyle += Math.min((lifestyle.healthyFoodCount / totalFoodDocs) * 10, 10)
  }

  // Fitness frequency
  cLifestyle +=
    lifestyle.fitnessCount >= 8 ? 8 :
    lifestyle.fitnessCount >= 4 ? 6 :
    lifestyle.fitnessCount >= 1 ? 3 : 0

  // Supplements/wellness
  cLifestyle +=
    lifestyle.supplementCount >= 2 ? 4 :
    lifestyle.supplementCount >= 1 ? 2 : 0

  // Water
  cLifestyle +=
    health.waterMl >= 2000 ? 3 :
    health.waterMl >= 1500 ? 2 :
    health.waterMl >= 1000 ? 1 : 0

  // Alcohol penalty
  if (lifestyle.alcoholCount >= 8) cLifestyle -= 3
  else if (lifestyle.alcoholCount >= 4) cLifestyle -= 1.5

  cLifestyle = Math.max(cLifestyle, 0)

  // 4. Financial-Health Connection (max 15)
  const cFinancial =
    wealthScore >= 80 ? 15 :
    wealthScore >= 60 ? 10 :
    wealthScore >= 40 ? 6  :
    wealthScore >= 20 ? 3  : 0

  const longevityScore = Math.min(
    Math.round(cPhysical + cMetabolic + cLifestyle + cFinancial),
    100
  )

  // ── Insights ──────────────────────────────────────────────────────────────

  const longevityInsights: string[] = []
  const wealthInsights:    string[] = []

  // Longevity insights
  if (health.steps > 0 && health.steps < 7500)
    longevityInsights.push(`เดิน ${Math.round(health.steps).toLocaleString()} ก้าว/วัน เป้า 10,000 ก้าว`)
  if (health.sleep > 0 && (health.sleep < 7 || health.sleep > 9))
    longevityInsights.push(`นอน ${health.sleep.toFixed(1)} ชั่วโมง เป้าหมาย 7–9 ชั่วโมง`)
  if (lifestyle.fitnessCount < 4)
    longevityInsights.push(`ออกกำลังกาย ${lifestyle.fitnessCount} ครั้ง/เดือน เป้า 4+ ครั้ง`)
  if (health.waterMl > 0 && health.waterMl < 2000)
    longevityInsights.push(`ดื่มน้ำ ${Math.round(health.waterMl)} ml/วัน เป้า 2,000 ml`)
  if (health.hrv > 0 && health.hrv < 40)
    longevityInsights.push(`HRV ${health.hrv.toFixed(0)} ms — ควรเพิ่มการพักผ่อน`)
  if (longevityInsights.length === 0)
    longevityInsights.push("สุขภาพโดยรวมอยู่ในเกณฑ์ดี 🌿")

  // Wealth insights
  if (finance.activeGoals === 0)
    wealthInsights.push("ยังไม่มีเป้าหมายการเงิน — ลองตั้งเป้าหมายแรกได้เลย")
  if (finance.totalSubs > 0 && finance.confirmedSubs < finance.totalSubs)
    wealthInsights.push(`${finance.totalSubs - finance.confirmedSubs} subscription ยังไม่ได้ยืนยัน`)
  if (finance.currMonthSpend > finance.avgMonthlySpend * 1.2)
    wealthInsights.push("ค่าใช้จ่ายเดือนนี้สูงกว่าค่าเฉลี่ย 20%")
  if (healthSpendRatio < 0.2)
    wealthInsights.push("ลงทุนด้านสุขภาพน้อยกว่า 20% ของค่าใช้จ่าย")
  if (wealthInsights.length === 0)
    wealthInsights.push("การเงินอยู่ในเกณฑ์ดี 💰")

  return {
    longevityScore,
    wealthScore,
    longevity: {
      physical:  Math.round(cPhysical  * 100) / 100,
      metabolic: Math.round(cMetabolic * 100) / 100,
      lifestyle: Math.round(cLifestyle * 100) / 100,
      financial: Math.round(cFinancial * 100) / 100,
    },
    wealth: {
      discipline:    Math.round(cDiscipline  * 100) / 100,
      goals:         Math.round(cGoals       * 100) / 100,
      subscriptions: Math.round(cSubs        * 100) / 100,
      healthInvest:  Math.round(cHealthInvest * 100) / 100,
      consistency:   Math.round(cConsistency  * 100) / 100,
    },
    longevityGrade: grade(longevityScore),
    wealthGrade:    grade(wealthScore),
    longevityInsights: longevityInsights.slice(0, 3),
    wealthInsights:    wealthInsights.slice(0, 3),
  }
}

// ─── Score Color Helpers ──────────────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 80) return "#10b981" // emerald
  if (score >= 60) return "#3b82f6" // blue
  if (score >= 40) return "#f59e0b" // amber
  return "#ef4444"                   // red
}

export function gradeLabel(g: "S" | "A" | "B" | "C" | "D"): string {
  const map = { S: "ยอดเยี่ยม", A: "ดีมาก", B: "ดี", C: "พัฒนาได้", D: "ต้องปรับปรุง" }
  return map[g]
}
