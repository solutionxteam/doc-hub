/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

// Single source of truth for plan definitions (mirrors pricing_plans DB table)
// Keep in sync with supabase/migrations/012_pricing_plans.sql

export type PlanId = "free" | "starter" | "personal" | "sme" | "business" | "enterprise"

export interface Plan {
  id:         PlanId
  nameTh:     string
  nameEn:     string
  priceTHB:   number        // 0 = free / contact sales
  docQuota:   number        // docs per month; 0 = unlimited
  features:   string[]
  highlighted?: boolean     // show as "popular"
}

export const PLANS: Plan[] = [
  {
    id:        "free",
    nameTh:    "ฟรี",
    nameEn:    "Free",
    priceTHB:  0,
    docQuota:  10,
    features:  [
      "10 เอกสาร/เดือน",
      "AI อ่านเอกสารอัตโนมัติ",
      "Export CSV",
      "ซัพพอร์ตทางอีเมล",
    ],
  },
  {
    id:        "starter",
    nameTh:    "เริ่มต้น",
    nameEn:    "Starter",
    priceTHB:  99,
    docQuota:  20,
    features:  [
      "20 เอกสาร/เดือน",
      "ทุกฟีเจอร์ใน Free",
      "เชื่อม LINE",
      "ซัพพอร์ตทางแชท",
    ],
  },
  {
    id:        "personal",
    nameTh:    "ส่วนตัว",
    nameEn:    "Personal",
    priceTHB:  199,
    docQuota:  50,
    features:  [
      "50 เอกสาร/เดือน",
      "ทุกฟีเจอร์ใน Starter",
      "Dashboard",
      "ซัพพอร์ตทางแชทเร็วขึ้น",
    ],
  },
  {
    id:          "sme",
    nameTh:      "ธุรกิจเล็ก",
    nameEn:      "SME",
    priceTHB:    599,
    docQuota:    300,
    highlighted: true,
    features:    [
      "300 เอกสาร/เดือน",
      "ทุกฟีเจอร์ใน Personal",
      "เชื่อม FlowAccount",
      "หลายผู้ใช้งาน",
      "Audit Log",
    ],
  },
  {
    id:        "business",
    nameTh:    "ธุรกิจ",
    nameEn:    "Business",
    priceTHB:  1499,
    docQuota:  1000,
    features:  [
      "1,000 เอกสาร/เดือน",
      "ทุกฟีเจอร์ใน SME",
      "API Access",
      "Priority Support",
      "Custom Webhook",
    ],
  },
  {
    id:        "enterprise",
    nameTh:    "องค์กร",
    nameEn:    "Enterprise",
    priceTHB:  0,
    docQuota:  0,  // 0 = unlimited
    features:  [
      "ไม่จำกัดเอกสาร",
      "ทุกฟีเจอร์ใน Business",
      "Dedicated Support",
      "SLA",
      "On-premise option",
    ],
  },
]

export const PLAN_MAP = Object.fromEntries(
  PLANS.map(p => [p.id, p])
) as Record<PlanId, Plan>

/** Returns the doc quota for a plan. 0 = unlimited (Enterprise). */
export function getDocQuota(planId: string): number {
  return PLAN_MAP[planId as PlanId]?.docQuota ?? 10
}

/** Returns true if the org has reached their monthly doc quota. */
export function isQuotaExceeded(planId: string, docUsed: number): boolean {
  const quota = getDocQuota(planId)
  return quota > 0 && docUsed >= quota
}
