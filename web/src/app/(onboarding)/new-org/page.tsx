/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { redirect }    from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NewOrgWizard } from "@/components/onboarding/new-org-wizard"

export default async function NewOrgPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <NewOrgWizard />
    </div>
  )
}
