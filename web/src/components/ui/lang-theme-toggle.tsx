"use client"

/**
 * LangThemeToggle — ปุ่มสลับภาษา + ธีม ที่ใช้ร่วมกันทุกหน้า
 *
 * Design: pill สองอัน ดังรูป
 *   [ ไทย | EN ]   [ ☀ | 🖥 | 🌙 ]
 *
 * ใช้ next-themes สำหรับ theme (sync กับ root ThemeProvider)
 * ใช้ cookie `locale` สำหรับ lang (sync กับ next-intl middleware)
 */

import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/* ── Inline SVG icons (ไม่ต้อง import หนัก) ─────────────────────────────── */
function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  )
}
function MonitorIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  )
}
function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
    </svg>
  )
}

/* ── Theme options ───────────────────────────────────────────────────────── */
const THEMES = [
  { value: "light",  Icon: SunIcon,     label: "Light" },
  { value: "system", Icon: MonitorIcon, label: "System" },
  { value: "dark",   Icon: MoonIcon,    label: "Dark" },
] as const

/* ── Props ───────────────────────────────────────────────────────────────── */
interface LangThemeToggleProps {
  /** locale ปัจจุบัน — ถ้าไม่ส่งจะอ่านจาก cookie */
  locale?: string
  /** callback เมื่อเปลี่ยนภาษา — ใช้สำหรับ page ที่มี local lang state เช่น landing */
  onLangChange?: (lang: string) => void
  /** class เพิ่มเติมสำหรับ wrapper */
  className?: string
  /** ขนาด icon (default 14) */
  iconSize?: number
}

/* ── Component ───────────────────────────────────────────────────────────── */
export function LangThemeToggle({
  locale: localeProp,
  onLangChange,
  className,
  iconSize = 14,
}: LangThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  // อ่าน locale จาก cookie ถ้าไม่ได้รับ prop
  const [locale, setLocale] = useState<string>(localeProp ?? "th")

  useEffect(() => {
    if (localeProp !== undefined) {
      setLocale(localeProp)
    } else {
      const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/)
      if (match?.[1]) setLocale(match[1])
    }
  }, [localeProp])

  const switchLocale = (newLocale: string) => {
    document.cookie = `locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`
    setLocale(newLocale)
    onLangChange?.(newLocale)   // แจ้ง parent (เช่น landing page) ให้อัพเดต local state
    if (!onLangChange) router.refresh()   // ถ้าไม่มี callback ให้ refresh เพื่อ re-render server component
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>

      {/* ── Language pill ──────────────────────────────────────── */}
      <div className="flex items-center rounded-lg border border-border bg-muted/60 backdrop-blur-sm p-0.5 gap-0.5">
        {(["th", "en"] as const).map(l => (
          <button
            key={l}
            onClick={() => switchLocale(l)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-semibold transition-all leading-none",
              locale === l
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {l === "th" ? "ไทย" : "EN"}
          </button>
        ))}
      </div>

      {/* ── Theme pill ─────────────────────────────────────────── */}
      <div className="flex items-center rounded-lg border border-border bg-muted/60 backdrop-blur-sm p-0.5 gap-0.5">
        {THEMES.map(({ value, Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            title={label}
            suppressHydrationWarning
            className={cn(
              "p-1.5 rounded-md transition-all",
              theme === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={iconSize} />
          </button>
        ))}
      </div>
    </div>
  )
}
