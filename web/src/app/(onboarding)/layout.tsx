import type { ReactNode } from "react"

/** Clean full-screen layout for the onboarding wizard — no sidebar, no header */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-brand-50/20
      dark:to-brand-950/10 flex items-center justify-center p-4">
      {children}
    </div>
  )
}
