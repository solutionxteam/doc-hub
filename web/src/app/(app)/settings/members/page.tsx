/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getMembership } from "@/lib/get-membership"
import { createClient }  from "@/lib/supabase/server"
import { MembersClient } from "@/components/settings/members-client"

export const dynamic = "force-dynamic"

export default async function MembersPage() {
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, role, joined_at, users(id, email, full_name, avatar_url)")
      .eq("organization_id", orgId)
      .order("joined_at"),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("organization_id", orgId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ])

  return (
    <MembersClient
      orgId={orgId}
      members={members ?? []}
      invitations={invitations ?? []}
      currentUserId={user?.id ?? ""}
      userRole={role}
    />
  )
}
