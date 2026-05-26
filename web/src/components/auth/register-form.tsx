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
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { slugify } from "@/lib/utils"
import { getDocQuota } from "@/lib/plans"

export function RegisterForm() {
  const t        = useTranslations("auth")
  const router   = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    fullName: "",
    email:    "",
    password: "",
    confirm:  "",
    orgName:  "",
  })
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (form.password !== form.confirm) {
      toast.error("รหัสผ่านไม่ตรงกัน")
      return
    }
    if (form.password.length < 8) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
      return
    }

    setLoading(true)

    // 1. Sign up
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options:  { data: { full_name: form.fullName } },
    })

    if (signUpError) {
      toast.error(signUpError.message)
      setLoading(false)
      return
    }

    // 2. Create organization — Free plan, no expiry, upgrade anytime
    const slug = slugify(form.orgName || form.fullName) + "-" + Date.now().toString(36)

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name:                form.orgName || `${form.fullName}'s Company`,
        slug,
        plan:                "free",
        subscription_status: "active",
        doc_quota:           getDocQuota("free"),  // 10 docs/month
      })
      .select("id")
      .single()

    if (orgError || !org) {
      toast.error("สร้างองค์กรไม่สำเร็จ")
      setLoading(false)
      return
    }

    // 3. Add user as owner
    await supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id:         authData.user!.id,
      role:            "owner",
    })

    toast.success("สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...")
    router.push("/dashboard")
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options:  { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  const InputField = ({
    label, field, type = "text", placeholder, required = true
  }: {
    label: string; field: keyof typeof form
    type?: string; placeholder?: string; required?: boolean
  }) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={form[field]}
        onChange={set(field)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border bg-background text-foreground
          text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2
          focus:ring-ring focus:border-transparent transition-shadow"
      />
    </div>
  )

  return (
    <form onSubmit={handleRegister} className="space-y-4">

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5
          border rounded-lg text-sm font-medium bg-background hover:bg-muted transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {t("loginWithGoogle")}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground bg-background px-2 w-fit mx-auto">
          {t("orContinueWith")}
        </div>
      </div>

      <InputField label={t("fullName")} field="fullName" placeholder="ชื่อ-นามสกุล" />
      <InputField label="ชื่อบริษัท / องค์กร" field="orgName"
        placeholder="บริษัท ABC จำกัด" required={false} />
      <InputField label={t("email")}    field="email"    type="email"    placeholder="you@company.com" />
      <InputField label={t("password")} field="password" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" />
      <InputField label={t("confirmPassword")} field="confirm" type="password" placeholder="ยืนยันรหัสผ่าน" />

      <p className="text-xs text-muted-foreground">
        {t("termsAgreement")}{" "}
        <Link href="/terms" className="text-brand-500 hover:underline">{t("terms")}</Link>
        {" และ "}
        <Link href="/privacy" className="text-brand-500 hover:underline">{t("privacy")}</Link>
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5
          bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg text-sm
          transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {t("register")}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-brand-500 hover:underline font-medium">
          {t("login")}
        </Link>
      </p>
    </form>
  )
}
