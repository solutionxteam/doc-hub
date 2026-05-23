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
