/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient }  from "@/lib/supabase/server"
import { redirect }       from "next/navigation"
import { LandingPage }    from "@/components/landing/landing-page"

export default async function RootPage() {
  const supabase          = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Authenticated users go straight to the app
  if (user) redirect("/dashboard")

  // Everyone else sees the marketing landing page
  return <LandingPage />
}
