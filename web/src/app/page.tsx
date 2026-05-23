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
