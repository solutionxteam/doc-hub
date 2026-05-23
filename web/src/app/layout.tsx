import type { Metadata }       from "next"
import { Inter, Noto_Sans_Thai } from "next/font/google"
import { getLocale, getMessages } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { ThemeProvider }         from "@/components/layout/theme-provider"
import { Toaster }               from "sonner"
import { CookieBanner, CookieManageButton } from "@/components/ui/cookie-banner"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto",
  display: "swap",
})

export const metadata: Metadata = {
  title:       { default: "Slippy", template: "%s | Slippy" },
  description: "ระบบจัดการเอกสารบัญชีอัจฉริยะ",
  keywords:    ["slippy", "accounting", "document", "AI", "OCR", "FlowAccount", "บัญชี", "สลิป"],
  manifest:    "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Slippy" },
  themeColor:  [
    { media: "(prefers-color-scheme: light)", color: "#6366f1" },
    { media: "(prefers-color-scheme: dark)",  color: "#312e81" },
  ],
  icons: {
    icon:  [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale   = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansThai.variable} font-sans`} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <CookieBanner />
            <CookieManageButton />
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                style: { fontFamily: "var(--font-noto), var(--font-inter), sans-serif" },
              }}
            />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
