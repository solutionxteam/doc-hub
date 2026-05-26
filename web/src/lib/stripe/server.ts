/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
})

// ─── Stripe Plan → Price ID mapping ──────────────────────────────────────────
// Source of truth for business logic: @/lib/plans.ts
// This file only maps plan IDs → Stripe Price IDs (monthly & yearly)
//
// Plan IDs must match lib/plans.ts exactly: starter | personal | sme | business | enterprise
// Env vars to set in Vercel / .env.local:
//   STRIPE_PRICE_STARTER_M   / STRIPE_PRICE_STARTER_Y
//   STRIPE_PRICE_PERSONAL_M  / STRIPE_PRICE_PERSONAL_Y
//   STRIPE_PRICE_SME_M       / STRIPE_PRICE_SME_Y
//   STRIPE_PRICE_BUSINESS_M  / STRIPE_PRICE_BUSINESS_Y
export const STRIPE_PRICES: Record<string, { priceId: string; priceIdY: string }> = {
  starter:  {
    priceId:  process.env.STRIPE_PRICE_STARTER_M  ?? "",
    priceIdY: process.env.STRIPE_PRICE_STARTER_Y  ?? "",
  },
  personal: {
    priceId:  process.env.STRIPE_PRICE_PERSONAL_M ?? "",
    priceIdY: process.env.STRIPE_PRICE_PERSONAL_Y ?? "",
  },
  sme: {
    priceId:  process.env.STRIPE_PRICE_SME_M      ?? "",
    priceIdY: process.env.STRIPE_PRICE_SME_Y      ?? "",
  },
  business: {
    priceId:  process.env.STRIPE_PRICE_BUSINESS_M ?? "",
    priceIdY: process.env.STRIPE_PRICE_BUSINESS_Y ?? "",
  },
}

export type StripePlanId = keyof typeof STRIPE_PRICES

// ─── Checkout session ─────────────────────────────────────────────────────────
export async function createCheckoutSession({
  orgId,
  userId,
  priceId,
  successUrl,
  cancelUrl,
  existingCustomerId,
}: {
  orgId?:              string    // optional: not required for personal_plus
  userId:              string
  priceId:             string
  successUrl:          string
  cancelUrl:           string
  existingCustomerId?: string
}) {
  const session = await stripe.checkout.sessions.create({
    mode:                 "subscription",
    payment_method_types: ["card"],
    customer:             existingCustomerId,
    line_items:           [{ price: priceId, quantity: 1 }],
    success_url:          successUrl,
    cancel_url:           cancelUrl,
    subscription_data: {
      metadata: {
        ...(orgId ? { org_id: orgId } : {}),
        user_id: userId,
      },
      // No trial — users start on Free and upgrade when ready
    },
    metadata: {
      ...(orgId ? { org_id: orgId } : {}),
      user_id: userId,
    },
    locale:                "th",
    currency:              "thb",
    allow_promotion_codes: true,
  })

  return session
}

// ─── Customer portal ──────────────────────────────────────────────────────────
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl:  string
}) {
  return stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: returnUrl,
  })
}
