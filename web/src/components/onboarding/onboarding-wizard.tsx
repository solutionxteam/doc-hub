"use client"

import { useState }  from "react"
import { useRouter } from "next/navigation"
import { toast }     from "sonner"
import { Loader2, User, ChevronRight, CheckCircle2, FileText, Building2, User2 } from "lucide-react"
import { cn }        from "@/lib/utils"

interface Props {
  userId:      string
  defaultName: string
  email:       string
}

const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
]

type Step = 1 | 2

export function OnboardingWizard({ userId: _userId, defaultName, email }: Props) {
  const router = useRouter()
  const [step, setStep]       = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [accountType, setAccountType] = useState<"business" | "personal">("business")

  const [form, setForm] = useState({
    fullName:      defaultName,
    orgName:       "",
    taxId:         "",
    address:       "",
    fiscalYearEnd: 12,   // December — common Thai fiscal year end
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: k === "fiscalYearEnd" ? Number(e.target.value) : e.target.value }))

  /* ── Step 1 validation ── */
  const step1Valid = form.fullName.trim().length >= 2

  /* ── Step 2 validation ── */
  const taxIdClean = form.taxId.replace(/\D/g, "")
  const step2Valid = accountType === "personal"
    ? form.orgName.trim().length >= 2
    : form.orgName.trim().length >= 2 && taxIdClean.length === 13 && form.address.trim().length >= 5

  const handleSubmit = async () => {
    if (!step2Valid) return
    setLoading(true)

    try {
      const res = await fetch("/api/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          fullName:      form.fullName.trim(),
          orgName:       form.orgName.trim(),
          taxId:         accountType === "business" ? taxIdClean : "",
          address:       accountType === "business" ? form.address.trim() : "",
          fiscalYearEnd: form.fiscalYearEnd,
          accountType,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด")

      toast.success("ตั้งค่าบัญชีสำเร็จ! ยินดีต้อนรับ 🎉")
      router.push("/dashboard")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  /* ─────────────────────────────── UI ─────────────────────────────── */

  return (
    <div className="w-full max-w-lg">

      {/* Logo + title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl
          bg-brand-500 mb-4 shadow-lg shadow-brand-500/30">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">ยินดีต้อนรับสู่ Slippy</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ตั้งค่าบัญชีของคุณในไม่กี่ขั้นตอน
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-all",
              s < step
                ? "bg-brand-500 text-white"
                : s === step
                ? "bg-brand-500 text-white ring-4 ring-brand-500/20"
                : "bg-muted text-muted-foreground"
            )}>
              {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            <span className={cn(
              "text-sm font-medium",
              s === step ? "text-foreground" : "text-muted-foreground"
            )}>
              {s === 1 ? "ข้อมูลส่วนตัว" : "ข้อมูลองค์กร"}
            </span>
            {idx < 1 && (
              <div className={cn(
                "flex-1 h-px",
                s < step ? "bg-brand-500" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">

        {/* ── Step 1: Profile ── */}
        {step === 1 && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20
                flex items-center justify-center">
                <User className="w-4 h-4 text-brand-500" />
              </div>
              <div>
                <h2 className="font-semibold text-base">ข้อมูลส่วนตัว</h2>
                <p className="text-xs text-muted-foreground">บอกเราเกี่ยวกับตัวคุณ</p>
              </div>
            </div>

            <Field label="ชื่อ-นามสกุล" required hint="อย่างน้อย 2 ตัวอักษร">
              <input
                type="text"
                value={form.fullName}
                onChange={set("fullName")}
                placeholder="กรอกชื่อ-นามสกุล"
                className={inputClass}
                autoFocus
              />
            </Field>

            <Field label="อีเมล" hint="ไม่สามารถเปลี่ยนแปลงได้">
              <input
                type="email"
                value={email}
                readOnly
                className={cn(inputClass, "opacity-60 cursor-not-allowed bg-muted")}
              />
            </Field>

            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className={primaryBtn}
            >
              ถัดไป <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* ── Step 2: Organization ── */}
        {step === 2 && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20
                flex items-center justify-center">
                <Building2 className="w-4 h-4 text-brand-500" />
              </div>
              <div>
                <h2 className="font-semibold text-base">ข้อมูลองค์กร</h2>
                <p className="text-xs text-muted-foreground">
                  ใช้สำหรับออกเอกสารและจัดการรายจ่าย
                </p>
              </div>
            </div>

            {/* Account type toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted">
              {(["business", "personal"] as const).map(type => (
                <button
                  key={type}
                  type="button"
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
                    : <><User2    className="w-4 h-4" /> ส่วนตัว</>
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
                    ? taxIdClean.length === 13
                      ? "✓ รูปแบบถูกต้อง"
                      : `กรอกแล้ว ${taxIdClean.length}/13 หลัก`
                    : "เลขนิติบุคคล หรือ เลขบัตรประชาชน 13 หลัก"}
                  hintError={taxIdClean.length > 0 && taxIdClean.length !== 13}
                >
                  <input
                    type="text"
                    value={form.taxId}
                    onChange={e => {
                      const val = e.target.value.replace(/[^\d\-]/g, "")
                      setForm(f => ({ ...f, taxId: val }))
                    }}
                    placeholder="0-0000-00000-00-0"
                    maxLength={17}
                    className={inputClass}
                  />
                </Field>

                <Field label="ที่อยู่บริษัท" required hint="ที่อยู่ที่ใช้บนเอกสารราชการ">
                  <textarea
                    value={form.address}
                    onChange={set("address")}
                    placeholder={"เลขที่ ... ถนน ... แขวง/ตำบล ... เขต/อำเภอ ... จังหวัด ... รหัสไปรษณีย์ ..."}
                    rows={3}
                    className={cn(inputClass, "resize-none")}
                  />
                </Field>
              </>
            )}

            <Field label="เดือนสิ้นปีบัญชี" required hint="สำหรับคำนวณรอบภาษีและรายงาน">
              <select
                value={form.fiscalYearEnd}
                onChange={set("fiscalYearEnd")}
                className={inputClass}
              >
                {MONTHS_TH.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium
                  hover:bg-muted transition-colors"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleSubmit}
                disabled={!step2Valid || loading}
                className={cn(primaryBtn, "flex-[2]")}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึก...</>
                  : <>เริ่มใช้งาน <CheckCircle2 className="w-4 h-4" /></>
                }
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        ข้อมูลเหล่านี้สามารถแก้ไขได้ภายหลังในหน้า ตั้งค่า
      </p>
    </div>
  )
}

/* ────────────────── helpers ────────────────── */

const inputClass = `w-full px-3 py-2.5 rounded-lg border bg-background text-foreground
  text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2
  focus:ring-ring focus:border-transparent transition-shadow`

const primaryBtn = `w-full flex items-center justify-center gap-2 py-2.5 px-4
  bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed`

function Field({
  label, required, hint, hintError, children,
}: {
  label: string
  required?: boolean
  hint?: string
  hintError?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className={cn(
          "text-xs",
          hintError ? "text-red-500" : "text-muted-foreground"
        )}>
          {hint}
        </p>
      )}
    </div>
  )
}
