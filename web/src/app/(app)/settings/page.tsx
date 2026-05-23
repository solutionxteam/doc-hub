import { getMembership }     from "@/lib/get-membership"
import { createClient }      from "@/lib/supabase/server"
import { notFound }          from "next/navigation"
import { SettingsForm }      from "@/components/settings/settings-form"
import { LineSection }       from "@/components/settings/line-section"

export default async function SettingsPage() {
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, tax_id, address, fiscal_year_end, plan")
    .eq("id", orgId)
    .single()

  if (!org) notFound()

  const isAdmin = ["owner", "admin"].includes(role)

  return (
    <div className="space-y-6 p-6">
      <SettingsForm org={org} userRole={role} />
      <LineSection orgId={orgId} isAdmin={isAdmin} />
    </div>
  )
}
