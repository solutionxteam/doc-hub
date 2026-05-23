import { redirect }     from "next/navigation"
import { cookies }      from "next/headers"
import { createClient } from "@/lib/supabase/server"

export interface Membership {
  organization_id: string
  role:            string
}

/**
 * Returns the currently-active org membership for the logged-in user.
 * Active org is determined by the `active-org` cookie; falls back to first membership.
 */
export async function getMembership(): Promise<Membership> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (!memberships?.length) redirect("/onboarding")

  // Honour active-org cookie if it matches one of the user's orgs
  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get("active-org")?.value
  const active = activeOrgId
    ? memberships.find(m => m.organization_id === activeOrgId)
    : null

  return (active ?? memberships[0]) as Membership
}
