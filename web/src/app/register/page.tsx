/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { RegisterForm } from "@/components/auth/register-form"
import { getTranslations } from "next-intl/server"
import { LogoMark } from "@/components/ui/logo"

export default async function RegisterPage() {
  const t = await getTranslations("auth")

  return (
    <div className="min-h-screen flex">

      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#070a18] flex-col
        justify-between p-12 relative overflow-hidden">

        <div className="absolute inset-0 glow-radial opacity-80" />
        <div className="absolute inset-0 glow-dotgrid opacity-30" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <LogoMark size={40} glow />
            <span className="text-white font-bold text-xl">Slippy</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            เริ่มต้นฟรี<br />ไม่มีหมดอายุ
          </h2>
          <p className="text-slate-400 text-sm">ไม่ต้องใส่บัตรเครดิต · อัปเกรดได้เมื่อพร้อม</p>
          <div className="space-y-3">
            {[
              { emoji: "⚡", text: "ใช้ได้ทันที — ฟรี 10 เอกสาร/เดือน ไม่มีหมดอายุ" },
              { emoji: "🤖", text: "AI อ่านเอกสารอัตโนมัติ ไม่ต้องพิมพ์เอง" },
              { emoji: "🔗", text: "เชื่อมต่อ FlowAccount และอื่นๆ ได้เลย" },
              { emoji: "📱", text: "รองรับ Mobile — ถ่ายรูปสลิปได้เลย" },
            ].map(({ emoji, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-xl">{emoji}</span>
                <span className="text-slate-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">
          © 2026 Slippy. All rights reserved.
        </p>
      </div>

      {/* Right — register form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">

          <div className="lg:hidden flex items-center gap-2 justify-center">
            <LogoMark size={32} />
            <span className="font-bold text-lg">Slippy</span>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 bg-brand-50 dark:bg-brand-500/10
              text-brand-600 dark:text-brand-400 text-xs font-medium px-2.5 py-1 rounded-full
              border border-brand-200 dark:border-brand-500/30 mb-3">
              🎉 ฟรีตลอด · ไม่มีหมดอายุ
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("createAccount")}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              ฟรี 10 เอกสาร/เดือน · อัปเกรดได้เมื่อพร้อม
            </p>
          </div>

          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
