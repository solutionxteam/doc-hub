import { getMembership } from "@/lib/get-membership"
import { createClient }  from "@/lib/supabase/server"
import { ProfileClient } from "@/components/profile/profile-client"

export default async function ProfilePage() {
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("organizations").select("name, plan").eq("id", orgId).single(),
  ])

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", user?.id ?? "")
    .single()

  const { data: membership } = await supabase
    .from("organization_members")
    .select("joined_at")
    .eq("user_id", user?.id ?? "")
    .eq("organization_id", orgId)
    .single()

  return (
    <ProfileClient
      userId={user?.id ?? ""}
      name={profile?.full_name ?? "—"}
      email={profile?.email    ?? user?.email ?? "—"}
      role={role}
      orgName={org?.name ?? "—"}
      orgPlan={org?.plan ?? "free"}
      joinedAt={membership?.joined_at ?? undefined}
    />
  )
}
