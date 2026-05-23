import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
})

export const PLANS = {
  starter:    { priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER!,    name: "Starter" },
  pro:        { priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!,        name: "Pro" },
  enterprise: { priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE!, name: "Enterprise" },
} as const

export async function createCheckoutSession({
  orgId,
  userId,
  priceId,
  successUrl,
  cancelUrl,
  existingCustomerId,
}: {
  orgId:               string
  userId:              string
  priceId:             string
  successUrl:          string
  cancelUrl:           string
  existingCustomerId?: string
}) {
  const session = await stripe.checkout.sessions.create({
    mode:                "subscription",
    payment_method_types: ["card"],
    customer:            existingCustomerId,
    line_items:          [{ price: priceId, quantity: 1 }],
    success_url:         successUrl,
    cancel_url:          cancelUrl,
    subscription_data: {
      metadata: { org_id: orgId, user_id: userId },
    },
    metadata: { org_id: orgId },
    locale:  "th",
    currency: "thb",
  })

  return session
}

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
