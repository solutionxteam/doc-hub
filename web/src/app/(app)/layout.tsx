import { redirect }     from "next/navigation"
import { cookies }      from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { AppShell }     from "@/components/layout/app-shell"
import { getLocale }    from "next-intl/server"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const locale = await getLocale()

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("users")
      .select("full_name, email, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("organization_members")
      .select("role, organizations(id, name, plan, slug)")
      .eq("user_id", user.id),
  ])

  if (!memberships?.length) redirect("/onboarding")

  // Determine active org from cookie
  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get("active-org")?.value

  const activeMembership = activeOrgId
    ? memberships.find(m => (m.organizations as any)?.id === activeOrgId)
    : null
  const current = activeMembership ?? memberships[0]
  const org     = (current.organizations as any) ?? { id: "", name: "", plan: "free", slug: "" }

  const allOrgs = memberships.map(m => {
    const o = m.organizations as any
    return { id: o?.id ?? "", name: o?.name ?? "", plan: o?.plan ?? "free", role: m.role }
  })

  return (
    <AppShell
      org={{ id: org.id, name: org.name, plan: org.plan }}
      allOrgs={allOrgs}
      user={{
        full_name:  profile?.full_name
          ?? (user.user_metadata?.full_name as string | undefined)
          ?? "",
        email:      profile?.email ?? user.email ?? "",
        avatar_url: profile?.avatar_url ?? undefined,
      }}
      locale={locale}
    >
      {children}
    </AppShell>
  )
}
