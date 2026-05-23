import { getMembership }  from "@/lib/get-membership"
import { createClient }   from "@/lib/supabase/server"
import { notFound }       from "next/navigation"
import { BillingClient }  from "@/components/billing/billing-client"

export default async function BillingPage() {
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const [{ data: org }, { data: invoices }, { data: plans }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, plan, doc_used, doc_quota, stripe_customer_id, subscription_status, subscription_ends_at")
      .eq("id", orgId)
      .single(),
    supabase
      .from("billing_invoices")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("plans")
      .select("*")
      .order("sort_order", { ascending: true }),
  ])

  if (!org) notFound()

  return (
    <BillingClient
      org={org}
      invoices={invoices ?? []}
      plans={plans ?? []}
      userRole={role}
    />
  )
}
