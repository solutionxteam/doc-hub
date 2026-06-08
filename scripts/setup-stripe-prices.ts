/**
 * setup-stripe-prices.ts
 * สร้าง Stripe Products + Prices แล้วอัปเดต pricing_plans DB
 *
 * วิธีรัน:
 *   cd /path/to/project
 *   STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/setup-stripe-prices.ts
 *
 * หรือสำหรับ test:
 *   STRIPE_SECRET_KEY=sk_test_xxx npx tsx scripts/setup-stripe-prices.ts
 */

import Stripe from "stripe"

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!STRIPE_KEY) { console.error("❌ STRIPE_SECRET_KEY required"); process.exit(1) }

const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-04-10" })

const PLANS = [
  { id: "pro",      name: "Slippy Pro",      monthly: 19900, yearly: 190800 },  // ฿199, ฿1,908
  { id: "premium",  name: "Slippy Premium",  monthly: 49900, yearly: 478800 },  // ฿499, ฿4,788
  { id: "team",     name: "Slippy Team",     monthly: 99900, yearly: 958800 },  // ฿999, ฿9,588
  { id: "business", name: "Slippy Business", monthly: 299000, yearly: 2870400 }, // ฿2,990, ฿28,704
]

async function main() {
  console.log("🚀 Setting up Stripe products and prices...\n")
  const results: Record<string, { monthly: string; yearly: string }> = {}

  for (const plan of PLANS) {
    console.log(`📦 ${plan.name}...`)

    // Create or find product
    const products = await stripe.products.list({ limit: 100 })
    let product = products.data.find(p => p.metadata?.plan_id === plan.id)

    if (!product) {
      product = await stripe.products.create({
        name:     plan.name,
        metadata: { plan_id: plan.id, app: "slippy" },
      })
      console.log(`   ✅ Created product: ${product.id}`)
    } else {
      console.log(`   ♻️  Existing product: ${product.id}`)
    }

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product:    product.id,
      currency:   "thb",
      unit_amount: plan.monthly,
      recurring:  { interval: "month" },
      metadata:   { plan_id: plan.id, billing: "monthly" },
    })
    console.log(`   💳 Monthly: ${monthlyPrice.id} (฿${plan.monthly / 100})`)

    // Create yearly price
    const yearlyPrice = await stripe.prices.create({
      product:    product.id,
      currency:   "thb",
      unit_amount: plan.yearly,
      recurring:  { interval: "year" },
      metadata:   { plan_id: plan.id, billing: "yearly" },
    })
    console.log(`   💳 Yearly:  ${yearlyPrice.id} (฿${plan.yearly / 100}/yr)`)

    results[plan.id] = { monthly: monthlyPrice.id, yearly: yearlyPrice.id }
  }

  // Update Supabase
  if (SUPABASE_URL && SUPABASE_KEY) {
    console.log("\n📊 Updating Supabase pricing_plans...")
    for (const [planId, prices] of Object.entries(results)) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pricing_plans?id=eq.${planId}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ stripe_price_id_m: prices.monthly, stripe_price_id_y: prices.yearly }),
      })
      console.log(`   ✅ Updated ${planId}: ${res.status === 204 ? "OK" : "Failed"}`)
    }
  }

  console.log("\n✅ Done! Price IDs:")
  console.log(JSON.stringify(results, null, 2))
}

main().catch(console.error)
