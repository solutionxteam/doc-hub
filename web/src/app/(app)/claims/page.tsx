import { getMembership } from "@/lib/get-membership"
import { createClient }  from "@/lib/supabase/server"
import { ClaimsClient }  from "@/components/claims/claims-client"

export default async function ClaimsPage() {
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const isManager = ["owner", "admin"].includes(role)

  const [claimsRes, projectsRes, statsRes] = await Promise.all([
    supabase.from("expense_claims")
      .select(`id, title, amount, status, submitted_at, reviewed_at, category,
               documents(vendor_name), business_projects(name)`)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("business_projects")
      .select("id, name, status, budget")
      .eq("organization_id", orgId)
      .eq("status", "active"),
    // Simple stats
    supabase.from("expense_claims")
      .select("status, amount")
      .eq("organization_id", orgId),
  ])

  const stats = {
    pending:  (statsRes.data ?? []).filter(c => c.status === "submitted").length,
    approved: (statsRes.data ?? []).filter(c => c.status === "approved").length,
    total:    (statsRes.data ?? []).filter(c => ["approved","paid"].includes(c.status))
                .reduce((s, c) => s + Number(c.amount), 0),
  }

  return (
    <ClaimsClient
      orgId={orgId}
      userId={user?.id ?? ""}
      isManager={isManager}
      claims={(claimsRes.data ?? []) as any}
      projects={projectsRes.data ?? []}
      stats={stats}
    />
  )
}
