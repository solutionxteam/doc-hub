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
import { ProfileClient } from "@/components/profile/profile-client"

export default async function ProfilePage() {
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: org },
    { data: profile },
    { data: membership },
    { data: activityLogs },
    { data: lineConn },
  ] = await Promise.all([
    supabase.from("organizations").select("name, plan").eq("id", orgId).single(),
    supabase.from("users").select("full_name, email").eq("id", user?.id ?? "").single(),
    supabase.from("organization_members").select("joined_at")
      .eq("user_id", user?.id ?? "").eq("organization_id", orgId).single(),
    // Real activity from privacy logs
    supabase.from("user_activity_logs")
      .select("id, action, detail, created_at")
      .eq("user_id", user?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(6),
    // Check if user has a LINE connection in this org
    supabase.from("line_connections")
      .select("id, display_name, created_at")
      .eq("organization_id", orgId)
      .eq("user_id", user?.id ?? "")
      .maybeSingle(),
  ])

  return (
    <ProfileClient
      userId={user?.id ?? ""}
      name={profile?.full_name ?? "—"}
      email={profile?.email    ?? user?.email ?? "—"}
      role={role}
      orgName={org?.name ?? "—"}
      orgPlan={org?.plan ?? "free"}
      joinedAt={membership?.joined_at ?? undefined}
      activityLogs={activityLogs ?? []}
      lineConnection={lineConn ?? null}
    />
  )
}
