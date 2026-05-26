/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { redirect }           from "next/navigation"
import { createClient }        from "@/lib/supabase/server"
import { IntegrationsClient }  from "@/components/settings/integrations-client"

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .single()

  if (!membership) redirect("/dashboard")

  const orgId = membership.organization_id

  const [{ data: integrations }, { data: lineConn }, { data: org }] = await Promise.all([
    supabase
      .from("integrations")
      .select("id, provider, is_active, last_synced_at, meta")
      .eq("organization_id", orgId),
    supabase
      .from("line_connections")
      .select("id, line_user_id, display_name, created_at")
      .eq("organization_id", orgId)
      .limit(5),
    supabase
      .from("organizations")
      .select("slug")
      .eq("id", orgId)
      .single(),
  ])

  return (
    <IntegrationsClient
      orgId={orgId}
      orgSlug={org?.slug ?? ""}
      integrations={integrations ?? []}
      lineConnections={lineConn ?? []}
      userRole={membership.role}
    />
  )
}
