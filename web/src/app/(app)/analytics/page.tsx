import { getMembership }   from "@/lib/get-membership"
import { createClient }    from "@/lib/supabase/server"
import { AnalyticsClient } from "@/components/analytics/analytics-client"

export default async function AnalyticsPage() {
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  // 12-month summary
  const { data: monthly } = await supabase
    .from("monthly_expense_summary")
    .select("*")
    .eq("organization_id", orgId)
    .order("month", { ascending: true })
    .limit(12)

  // Top vendors (last 3 months)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: topVendors } = await supabase.rpc("get_top_vendors", {
    p_org_id:    orgId,
    p_date_from: threeMonthsAgo.toISOString().split("T")[0],
    p_date_to:   new Date().toISOString().split("T")[0],
    p_limit:     10,
  })

  return <AnalyticsClient monthly={monthly ?? []} topVendors={topVendors ?? []} />
}
