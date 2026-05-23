import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createCheckoutSession, PLANS } from "@/lib/stripe/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { planId, orgId } = await req.json()

  const plan = PLANS[planId as keyof typeof PLANS]
  if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 })

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", orgId)
    .single()

  const session = await createCheckoutSession({
    orgId,
    userId:              user.id,
    priceId:             plan.priceId,
    successUrl:          `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
    cancelUrl:           `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    existingCustomerId:  org?.stripe_customer_id ?? undefined,
  })

  return NextResponse.json({ url: session.url })
}
