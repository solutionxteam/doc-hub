"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState }      from "react"
import { useRouter }     from "next/navigation"
import { toast }         from "sonner"
import { Loader2, Building2, CheckCircle2, FileText, User2 } from "lucide-react"
import { cn }            from "@/lib/utils"

const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
]

export function NewOrgWizard() {
  const router  = useRouter()
  const [loading,     setLoading]     = useState(false)
  const [accountType, setAccountType] = useState<"business" | "personal">("business")
  const [form, setForm] = useState({
    orgName:       "",
    taxId:         "",
    address:       "",
    fiscalYearEnd: 12,
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: k === "fiscalYearEnd" ? Number(e.target.value) : e.target.value }))

  const taxIdClean = form.taxId.replace(/\D/g, "")

  const isValid = accountType === "personal"
    ? form.orgName.trim().length >= 2
    : form.orgName.trim().length >= 2 && taxIdClean.length === 13 && form.address.trim().length >= 5

  const handleSubmit = async () => {
    if (!isValid) return
    setLoading(true)

    try {
      const res = await fetch("/api/onboarding/new-org", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orgName:       form.orgName.trim(),
          taxId:         accountType === "business" ? taxIdClean : "",
          address:       accountType === "business" ? form.address.trim() : "",
          fiscalYearEnd: form.fiscalYearEnd,
          accountType,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด")

      if (data.orgId) {
        await fetch("/api/org/switch", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ orgId: data.orgId }),
        })
      }

      toast.success("สร้างองค์กรใหม่สำเร็จ! 🎉")
      router.push("/dashboard")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl
          bg-brand-500 mb-4 shadow-lg shadow-brand-500/30">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold">สร้างองค์กรใหม่</h1>
        <p className="text-muted-foreground text-sm mt-1">เพิ่มองค์กรสำหรับจัดการเอกสารแยกต่างหาก</p>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-brand-500" />
          </div>
          <div>
            <h2 className="font-semibold text-base">ข้อมูลองค์กร</h2>
            <p className="text-xs text-muted-foreground">ใช้สำหรับออกเอกสารและจัดการรายจ่าย</p>
          </div>
        </div>

        {/* Account type toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted">
          {(["business", "personal"] as const).map(type => (
            <button
              key={type}
              onClick={() => setAccountType(type)}
              className={cn(
                "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                accountType === type
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {type === "business"
                ? <><Building2 className="w-4 h-4" /> ธุรกิจ</>
                : <><User2    className="w-4 h-4" /> ส่วนตัว / Freelance</>
              }
            </button>
          ))}
        </div>

        <Field label={accountType === "personal" ? "ชื่อบัญชี" : "ชื่อบริษัท / องค์กร"} required>
          <input
            type="text"
            value={form.orgName}
            onChange={set("orgName")}
            placeholder={accountType === "personal" ? "เช่น บัญชีส่วนตัว, Freelance" : "บริษัท ABC จำกัด"}
            className={inputClass}
            autoFocus
          />
        </Field>

        {accountType === "business" && (
          <>
            <Field
              label="เลขประจำตัวผู้เสียภาษี (13 หลัก)"
              required
              hint={taxIdClean.length > 0
                ? taxIdClean.length === 13 ? "✓ รูปแบบถูกต้อง" : `${taxIdClean.length}/13 หลัก`
                : "เลขนิติบุคคล หรือเลขบัตรประชาชน"}
              hintError={taxIdClean.length > 0 && taxIdClean.length !== 13}
            >
              <input
                type="text"
                value={form.taxId}
                onChange={e => setForm(f => ({ ...f, taxId: e.target.value.replace(/[^\d\-]/g, "") }))}
                placeholder="0-0000-00000-00-0"
                maxLength={17}
                className={inputClass}
              />
            </Field>

            <Field label="ที่อยู่" required hint="ที่อยู่ที่ใช้บนเอกสาร">
              <textarea
                value={form.address}
                onChange={set("address")}
                placeholder="เลขที่ ... ถนน ... แขวง/ตำบล ... จังหวัด ..."
                rows={3}
                className={cn(inputClass, "resize-none")}
              />
            </Field>
          </>
        )}

        <Field label="เดือนสิ้นปีบัญชี" required>
          <select value={form.fiscalYearEnd} onChange={set("fiscalYearEnd")} className={inputClass}>
            {MONTHS_TH.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className={cn(primaryBtn, "flex-[2]")}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังสร้าง...</>
              : <><CheckCircle2 className="w-4 h-4" /> สร้างองค์กร</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

const inputClass = `w-full px-3 py-2.5 rounded-lg border bg-background text-foreground
  text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2
  focus:ring-ring focus:border-transparent transition-shadow`

const primaryBtn = `w-full flex items-center justify-center gap-2 py-2.5 px-4
  bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed`

function Field({ label, required, hint, hintError, children }: {
  label: string; required?: boolean; hint?: string; hintError?: boolean; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className={cn("text-xs", hintError ? "text-red-500" : "text-muted-foreground")}>{hint}</p>}
    </div>
  )
}
