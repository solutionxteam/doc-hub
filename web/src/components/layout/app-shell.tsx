"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState, useEffect } from "react"
import { usePathname }         from "next/navigation"
import { Sidebar }             from "./sidebar"
import { Header }              from "./header"

export interface OrgOption {
  id:   string
  name: string
  plan: string
  role: string
}

interface AppShellProps {
  org:            { id: string; name: string; plan: string }
  allOrgs:        OrgOption[]
  user:           { full_name: string; email: string; avatar_url?: string }
  locale:         string
  isSuperadmin?:  boolean
  children:       React.ReactNode
}

export function AppShell({ org, allOrgs, user, locale, isSuperadmin = false, children }: AppShellProps) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted,    setMounted]    = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed")
    if (stored !== null) setCollapsed(stored === "true")
    setMounted(true)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const toggleDesktop = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem("sidebar-collapsed", String(next))
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        org={org}
        allOrgs={allOrgs}
        user={user}
        collapsed={mounted ? collapsed : false}
        mobileOpen={mobileOpen}
        onToggle={toggleDesktop}
        onMobileClose={() => setMobileOpen(false)}
        isSuperadmin={isSuperadmin}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title=""
          locale={locale}
          onMobileMenuClick={() => setMobileOpen(o => !o)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
