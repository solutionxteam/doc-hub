"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { Icons } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface HeaderProps {
  title:             string
  locale:            string
  onMobileMenuClick: () => void
}

export function Header({ title, locale, onMobileMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const t = useTranslations("settings")
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function fetchUnread() {
      try {
        const res = await fetch("/api/notifications?unread_only=true&limit=1")
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setUnreadCount(json.unreadCount ?? 0)
      } catch {
        // silently ignore — bell just stays blank
      }
    }
    fetchUnread()
    // Refresh every 60 seconds while tab is open
    const interval = setInterval(fetchUnread, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const switchLocale = async (newLocale: string) => {
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3
      h-[57px] px-4 lg:px-7 border-b bg-card/80 backdrop-blur-sm">

      {/* Hamburger — mobile only */}
      <button
        onClick={onMobileMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-lg text-muted-foreground
          hover:text-foreground hover:bg-muted transition-colors"
        aria-label="เปิดเมนู"
      >
        <Icons.Menu size={20} />
      </button>

      {/* Page title */}
      <h1 className="flex-1 text-base font-semibold text-foreground truncate">
        {title}
      </h1>

      <div className="flex items-center gap-1">

        {/* Language switcher — hidden on very small screens */}
        <div className="hidden sm:flex items-center rounded-lg border bg-muted/50 p-0.5">
          {["th", "en"].map((l) => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                locale === l
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l === "th" ? "ไทย" : "EN"}
            </button>
          ))}
        </div>

        {/* Theme switcher */}
        <div className="flex items-center rounded-lg border bg-muted/50 p-0.5 sm:ml-1">
          {[
            { value: "light",  icon: Icons.Sun },
            { value: "system", icon: Icons.Monitor },
            { value: "dark",   icon: Icons.Moon },
          ].map(({ value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              title={t(value as any)}
              suppressHydrationWarning
              className={cn(
                "p-1.5 rounded-md transition-all",
                theme === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        {/* Notifications */}
        <button
          onClick={() => router.push("/notifications")}
          className="relative h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center
            text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount} ยังไม่อ่าน)` : ""}`}
        >
          <Icons.Bell size={17} />
          {unreadCount > 0 && (
            unreadCount <= 9 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5
                rounded-full bg-rose-500 text-white text-[9px] font-bold
                flex items-center justify-center leading-none">
                {unreadCount}
              </span>
            ) : (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1
                rounded-full bg-rose-500 text-white text-[9px] font-bold
                flex items-center justify-center leading-none">
                9+
              </span>
            )
          )}
        </button>
      </div>
    </header>
  )
}
