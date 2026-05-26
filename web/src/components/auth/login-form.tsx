"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Icons } from "@/components/ui/icons"

export function LoginForm() {
  const router   = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
        : error.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-[28px] font-bold tracking-tight text-foreground">ยินดีต้อนรับกลับ</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">เข้าสู่บัญชี Slippy ของคุณ</p>

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        className="mt-7 w-full h-11 rounded-[10px] border border-border bg-card hover:bg-muted
          transition-colors flex items-center justify-center gap-3 text-sm font-medium text-foreground"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.26 1.05-3.72 1.05-2.86 0-5.29-1.94-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.32 9.14 5.38 12 5.38z"/>
        </svg>
        เข้าสู่ระบบด้วย Google
      </button>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="flex-1 h-px bg-border" />
        หรือดำเนินการด้วย
        <span className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">อีเมล</label>
          <div className="relative">
            <Icons.Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="w-full h-11 pl-9 pr-3 rounded-[10px] border border-border bg-card text-sm
                text-foreground placeholder:text-muted-foreground outline-none
                focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-medium text-foreground">รหัสผ่าน</label>
            <button
              type="button"
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              ลืมรหัสผ่าน?
            </button>
          </div>
          <div className="relative">
            <Icons.ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full h-11 pl-9 pr-10 rounded-[10px] border border-border bg-card text-sm
                text-foreground placeholder:text-muted-foreground outline-none
                focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <Icons.EyeOff size={16} /> : <Icons.Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500/30"
          />
          จดจำการเข้าสู่ระบบบนเครื่องนี้
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white font-medium
            text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Icons.Loader size={16} />}
          เข้าสู่ระบบ
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
          สมัครสมาชิก
        </Link>
      </p>

      {/* Demo info */}
      <div className="mt-7 p-3.5 bg-muted rounded-[10px] text-[12px] text-muted-foreground space-y-2.5">
        <div className="flex gap-2.5">
          <Icons.Info size={14} className="text-brand-500 shrink-0 mt-0.5" />
          <span>
            <b className="text-foreground">Demo Account</b>{" "}
            — สำหรับทดลองใช้งานระบบโดยไม่ต้องสมัคร
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setEmail("demo@slippy.app"); setPassword("password") }}
          className="w-full h-8 rounded-[8px] border border-brand-200 dark:border-brand-700
            text-brand-600 dark:text-brand-400 text-[12px] font-medium
            hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
        >
          เข้าสู่ระบบด้วย Demo Account
        </button>
      </div>
    </div>
  )
}
