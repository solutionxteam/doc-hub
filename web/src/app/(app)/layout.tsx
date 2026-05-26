/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { redirect }     from "next/navigation"
import { cookies }      from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { AppShell }     from "@/components/layout/app-shell"
import { getLocale }    from "next-intl/server"
import Link             from "next/link"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const locale = await getLocale()

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("users")
      .select("full_name, email, avatar_url, is_superadmin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("organization_members")
      .select("role, organizations(id, name, plan, slug, is_demo)")
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
  const org     = (current.organizations as any) ?? { id: "", name: "", plan: "free", slug: "", is_demo: false }
  const isDemo  = Boolean(org.is_demo)

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
      isSuperadmin={profile?.is_superadmin === true}
    >
      {/* Demo mode banner — pinned top, warns user that data resets daily */}
      {isDemo && (
        <div className="sticky top-0 z-40 w-full bg-amber-400 dark:bg-amber-500 text-amber-950 text-[12.5px] font-medium
          flex items-center justify-center gap-2 px-4 py-1.5 shadow-sm">
          <span>🎯</span>
          <span>
            โหมด Demo — ข้อมูลจะถูกรีเซ็ตทุกวัน ·{" "}
            <strong>ไม่มีผลกระทบต่อข้อมูลจริง</strong>{" "}
            ·{" "}
            <Link href="/register" className="underline underline-offset-2 hover:opacity-80">
              สมัครใช้งานฟรี ไม่มีหมดอายุ
            </Link>
          </span>
        </div>
      )}
      {children}
    </AppShell>
  )
}
