/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getMembership }  from "@/lib/get-membership"
import { createClient }   from "@/lib/supabase/server"
import { notFound }       from "next/navigation"
import { BillingClient }  from "@/components/billing/billing-client"

export default async function BillingPage() {
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const [{ data: org }, { data: invoices }] = await Promise.all([
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
  ])

  if (!org) notFound()

  return (
    <BillingClient
      org={org}
      invoices={invoices ?? []}
      userRole={role}
    />
  )
}
