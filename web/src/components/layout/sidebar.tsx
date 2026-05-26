"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState }                    from "react"
import Link                            from "next/link"
import { usePathname, useRouter }      from "next/navigation"
import { useTranslations }             from "next-intl"
import { Icons }         from "@/components/ui/icons"
import { cn }            from "@/lib/utils"
import { createClient }  from "@/lib/supabase/client"
import { LogoMark }      from "@/components/ui/logo"
import type { OrgOption } from "./app-shell"

const navItems = [
  { key: "dashboard",   href: "/dashboard",     icon: Icons.Dashboard },
  { key: "documents",   href: "/documents",     icon: Icons.FileText },
  { key: "analytics",   href: "/analytics",     icon: Icons.BarChart },
  { key: "tax",         href: "/tax",            icon: Icons.Receipt },
  { key: "vendors",     href: "/vendors",        icon: Icons.Building },
  { key: "split",       href: "/split",          icon: Icons.Split },
  { key: "lineStudio",  href: "/line-studio",    icon: Icons.LineBot },
  { key: "mobile",      href: "/mobile",         icon: Icons.Smartphone },
]

const bottomItems = [
  { key: "billing",       href: "/billing",               icon: Icons.CreditCard },
  { key: "members",       href: "/settings/members",      icon: Icons.Users },
  { key: "integrations",  href: "/settings/integrations", icon: Icons.Plug },
  { key: "notifications", href: "/notifications",         icon: Icons.Bell },
  { key: "privacy",       href: "/privacy",               icon: Icons.ShieldCheck },
  { key: "profile",       href: "/profile",               icon: Icons.User },
  { key: "settings",      href: "/settings",              icon: Icons.Settings },
  { key: "help",          href: "/help",                  icon: Icons.HelpCircle },
]

interface SidebarProps {
  org:            { id: string; name: string; plan: string }
  allOrgs:        OrgOption[]
  user:           { full_name: string; email: string; avatar_url?: string }
  collapsed:      boolean
  mobileOpen:     boolean
  onToggle:       () => void
  onMobileClose:  () => void
  isSuperadmin?:  boolean
}

export function Sidebar({ org, allOrgs, user, collapsed, mobileOpen, onToggle, onMobileClose, isSuperadmin = false }: SidebarProps) {
  const t        = useTranslations("nav")
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const [switching,   setSwitching]   = useState<string | null>(null)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === org.id) { setOrgMenuOpen(false); return }
    setSwitching(orgId)
    await fetch("/api/org/switch", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ orgId }),
    })
    setOrgMenuOpen(false)
    setSwitching(null)
    router.push("/dashboard")
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const avatar = user.full_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-72",
        "transition-transform duration-200 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:static lg:inset-auto lg:translate-x-0 lg:shrink-0",
        "lg:transition-[width] lg:duration-200",
        collapsed ? "lg:w-[60px]" : "lg:w-64",
        "flex flex-col h-screen",
        "bg-sidebar border-r border-sidebar-border overflow-hidden"
      )}
    >
      {/* ── Logo + controls ── */}
      <div className={cn(
        "flex items-center gap-3 border-b border-sidebar-border py-[18px]",
        collapsed ? "lg:justify-center lg:px-0 px-5" : "px-5"
      )}>
        <LogoMark size={32} />
        <span className={cn(
          "flex-1 text-sidebar-fg font-bold text-lg tracking-tight whitespace-nowrap",
          collapsed && "lg:hidden"
        )}>
          Slippy
        </span>
        {!collapsed && (
          <button
            onClick={onToggle}
            className="hidden lg:flex p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-fg
              hover:bg-sidebar-muted/10 transition-colors"
            title="ย่อเมนู"
          >
            <Icons.PanelLeftClose size={16} />
          </button>
        )}
        <button
          onClick={onMobileClose}
          className="flex lg:hidden p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-fg
            hover:bg-sidebar-muted/10 transition-colors"
          title="ปิดเมนู"
        >
          <Icons.X size={16} />
        </button>
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center py-2 text-sidebar-muted
            hover:text-sidebar-fg hover:bg-sidebar-muted/10 transition-colors"
          title="ขยายเมนู"
        >
          <Icons.PanelLeftOpen size={16} />
        </button>
      )}

      {/* ── Organization switcher ── */}
      <div className={cn(
        "border-b border-sidebar-border relative",
        collapsed ? "lg:px-2 px-3 py-3" : "px-3 py-3"
      )}>
        {/* Icon-only (desktop collapsed) */}
        <div className={cn(collapsed ? "lg:flex hidden justify-center" : "hidden")}>
          <div className="w-8 h-8 rounded-md bg-brand-500/20 flex items-center justify-center" title={org.name}>
            <Icons.Building2 size={16} className="text-brand-500" />
          </div>
        </div>

        {/* Full button */}
        <button
          onClick={() => setOrgMenuOpen(o => !o)}
          className={cn(
            "w-full flex items-center gap-2.5 p-2 rounded-[10px] hover:bg-sidebar-muted/10 transition-colors border border-sidebar-border",
            collapsed && "lg:hidden"
          )}
        >
          <span className="h-8 w-8 rounded-[8px] bg-gradient-to-br from-brand-400 to-brand-700 text-white flex items-center justify-center shrink-0">
            <Icons.Building2 size={16} />
          </span>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sidebar-fg text-[13px] font-semibold truncate">{org.name}</p>
            <p className="text-sidebar-muted text-[11px] uppercase tracking-wider">{org.plan}</p>
          </div>
          <Icons.ChevronDown size={14} className={cn(
            "text-sidebar-muted shrink-0 transition-transform duration-150",
            orgMenuOpen && "rotate-180"
          )} />
        </button>

        {/* Dropdown */}
        {orgMenuOpen && !collapsed && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50
            rounded-xl border bg-popover shadow-lg overflow-hidden">
            <div className="p-1 space-y-0.5 max-h-56 overflow-y-auto">
              {allOrgs.map(o => (
                <button
                  key={o.id}
                  onClick={() => handleSwitchOrg(o.id)}
                  disabled={switching === o.id}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                    hover:bg-muted transition-colors disabled:opacity-60"
                >
                  <div className="w-7 h-7 rounded-md bg-brand-500/10 flex items-center justify-center shrink-0">
                    <Icons.Building2 size={14} className="text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{o.plan} · {o.role}</p>
                  </div>
                  {o.id === org.id && <Icons.Check size={16} className="text-brand-500 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="border-t p-1">
              <Link
                href="/new-org"
                onClick={() => setOrgMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                  text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Icons.Plus size={16} />
                สร้างองค์กรใหม่
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Main navigation ── */}
      <nav className={cn(
        "flex-1 overflow-y-auto py-4 space-y-0.5 scrollbar-thin",
        collapsed ? "lg:px-2 px-3" : "px-3"
      )}>
        {navItems.map(({ key, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={key}
              href={href}
              title={collapsed ? t(key as any) : undefined}
              className={cn(
                "sidebar-item",
                active && "active",
                collapsed && "lg:justify-center lg:px-0"
              )}
            >
              <Icon className={cn("w-[18px] h-[18px] shrink-0", active ? "text-brand-600 dark:text-brand-300" : "text-sidebar-muted")} />
              <span className={cn("truncate", collapsed && "lg:hidden")}>{t(key as any)}</span>
              {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0 lg:block hidden" />}
            </Link>
          )
        })}

        <div className={cn(collapsed ? "lg:block hidden pt-3 pb-1" : "hidden")}>
          <div className="border-t border-sidebar-border" />
        </div>
        <div className={cn(collapsed ? "lg:hidden pt-4 pb-1" : "pt-4 pb-1")}>
          <p className="px-3 text-xs font-medium text-sidebar-muted uppercase tracking-wider">
            {t("settings")}
          </p>
        </div>

        {bottomItems.map(({ key, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={key}
              href={href}
              title={collapsed ? t(key as any) : undefined}
              className={cn(
                "sidebar-item",
                active && "active",
                collapsed && "lg:justify-center lg:px-0"
              )}
            >
              <Icon className={cn("w-[18px] h-[18px] shrink-0", active ? "text-brand-600 dark:text-brand-300" : "text-sidebar-muted")} />
              <span className={cn("truncate", collapsed && "lg:hidden")}>{t(key as any)}</span>
              {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0 lg:block hidden" />}
            </Link>
          )
        })}

        {/* Admin Console — superadmin only */}
        {isSuperadmin && (
          <Link
            href="/admin/plans"
            title={collapsed ? "Admin Console" : undefined}
            className={cn(
              "sidebar-item mt-1",
              pathname.startsWith("/admin") && "active",
              collapsed && "lg:justify-center lg:px-0",
              "text-amber-500/80 hover:text-amber-400"
            )}
          >
            <Icons.Settings className="w-[18px] h-[18px] shrink-0" />
            <span className={cn("truncate", collapsed && "lg:hidden")}>Admin Console</span>
          </Link>
        )}
      </nav>

      {/* ── User footer ── */}
      <div className={cn(
        "border-t border-sidebar-border py-4",
        collapsed ? "lg:px-2 px-3" : "px-3"
      )}>
        <div className={cn("flex-col items-center gap-2", collapsed ? "lg:flex hidden" : "hidden")}>
          <div
            className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center
              text-brand-500 font-semibold text-sm"
            title={user.full_name ?? user.email}
          >
            {avatar}
          </div>
          <button
            onClick={handleLogout}
            title={t("logout")}
            className="p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-fg
              hover:bg-sidebar-muted/10 transition-colors"
          >
            <Icons.LogOut size={16} />
          </button>
        </div>
        <div className={cn("flex items-center gap-3 px-3 py-2 rounded-lg", collapsed && "lg:hidden")}>
          <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center
            text-brand-500 font-semibold text-sm shrink-0">
            {avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-fg text-sm font-medium truncate">
              {user.full_name ?? user.email}
            </p>
            <p className="text-sidebar-muted text-xs truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title={t("logout")}
            className="p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-fg
              hover:bg-sidebar-muted/10 transition-colors shrink-0"
          >
            <Icons.LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
