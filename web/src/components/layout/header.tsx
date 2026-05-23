"use client"

import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { Icons } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface HeaderProps {
  title:             string
  locale:            string
  onMobileMenuClick: () => void
}

export function Header({ title, locale, onMobileMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const t = useTranslations("settings")
  const router = useRouter()

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
        <button className="relative h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center
          text-muted-foreground hover:text-foreground transition-colors">
          <Icons.Bell size={17} />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
        </button>
      </div>
    </header>
  )
}
