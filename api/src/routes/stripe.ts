import type { FastifyInstance } from "fastify"
import Stripe from "stripe"
import { supabase } from "../lib/supabase"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PLAN_PRICE_MAP: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER   ?? ""]: "starter",
  [process.env.STRIPE_PRICE_PRO       ?? ""]: "pro",
  [process.env.STRIPE_PRICE_ENTERPRISE ?? ""]: "enterprise",
}

export async function stripeRoutes(app: FastifyInstance) {

  // POST /webhooks/stripe — receive Stripe events
  app.post(
    "/stripe",
    { config: { rawBody: true } },
    async (req, reply) => {
      const sig = req.headers["stripe-signature"] as string
      let event: Stripe.Event

      try {
        event = stripe.webhooks.constructEvent(
          (req as any).rawBody,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET!
        )
      } catch {
        return reply.status(400).send({ error: "Invalid signature" })
      }

      // Idempotency: skip if already processed
      const { data: existing } = await supabase
        .from("stripe_events")
        .select("id")
        .eq("id", event.id)
        .single()

      if (existing) return { received: true }

      // Save event
      await supabase.from("stripe_events").insert({
        id:   event.id,
        type: event.type,
        data: event.data,
      })

      // Handle event types
      switch (event.type) {

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription
          const orgId = sub.metadata?.org_id
          if (!orgId) break

          const priceId = sub.items.data[0]?.price.id ?? ""
          const planId  = PLAN_PRICE_MAP[priceId] ?? "free"

          await supabase.rpc("sync_subscription", {
            p_org_id:             orgId,
            p_stripe_sub_id:      sub.id,
            p_stripe_customer_id: sub.customer as string,
            p_status:             sub.status,
            p_plan_id:            planId,
            p_ends_at:            new Date(sub.current_period_end * 1000).toISOString(),
          })
          break
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription
          const orgId = sub.metadata?.org_id
          if (!orgId) break

          await supabase.rpc("sync_subscription", {
            p_org_id:             orgId,
            p_stripe_sub_id:      sub.id,
            p_stripe_customer_id: sub.customer as string,
            p_status:             "canceled",
            p_plan_id:            "free",
            p_ends_at:            null,
          })
          break
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice
          const customerId = invoice.customer as string

          const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single()

          if (org) {
            await supabase.from("billing_invoices").insert({
              organization_id:   org.id,
              stripe_invoice_id: invoice.id,
              stripe_payment_id: invoice.payment_intent as string,
              amount_paid:       invoice.amount_paid / 100,
              currency:          invoice.currency,
              status:            "paid",
              invoice_url:       invoice.hosted_invoice_url,
              invoice_pdf:       invoice.invoice_pdf,
              period_start:      invoice.period_start
                ? new Date(invoice.period_start * 1000).toISOString() : null,
              period_end:        invoice.period_end
                ? new Date(invoice.period_end * 1000).toISOString() : null,
            })
          }
          break
        }

        // ── Doc Pack (one-time payment) ──────────────────────────────────
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session
          if (session.metadata?.type !== "doc_pack") break

          const orgId   = session.metadata.org_id
          const docsAdd = Number(session.metadata.docs_add ?? 0)
          if (!orgId || !docsAdd) break

          // Increment doc_quota atomically
          await supabase.rpc("add_doc_quota", {
            p_org_id:  orgId,
            p_docs_add: docsAdd,
          })

          // Record in billing_invoices
          await supabase.from("billing_invoices").insert({
            id:              session.id,
            organization_id: orgId,
            amount_paid:     (session.amount_total ?? 0) / 100,
            status:          "paid",
          })
          break
        }
      }

      return { received: true }
    }
  )
}
