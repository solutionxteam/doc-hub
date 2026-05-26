/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { redirect }     from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Must be logged in
  if (!user) redirect("/login")

  // Already has an org → go straight to the app
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  if (membership) redirect("/dashboard")

  // Load existing profile (may exist if email/password signup already set it)
  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single()

  const defaultName = profile?.full_name
    ?? (user.user_metadata?.full_name as string | undefined)
    ?? ""

  return (
    <OnboardingWizard
      userId={user.id}
      defaultName={defaultName}
      email={user.email ?? ""}
    />
  )
}
