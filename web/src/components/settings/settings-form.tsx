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
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Trash2, Building2, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props { org: any; userRole: string }

const MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

export function SettingsForm({ org, userRole }: Props) {
  const supabase = createClient()
  const router   = useRouter()
  const canEdit  = ["owner", "admin"].includes(userRole)

  const [name,        setName]        = useState(org.name            ?? "")
  const [taxId,       setTaxId]       = useState(org.tax_id          ?? "")
  const [address,     setAddress]     = useState(org.address         ?? "")
  const [fyEnd,       setFyEnd]       = useState(org.fiscal_year_end ?? 12)
  const [accountType, setAccountType] = useState<"business" | "personal">(org.account_type ?? "business")
  const [saving,      setSaving]      = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from("organizations")
      .update({ name, tax_id: taxId, address, fiscal_year_end: fyEnd, account_type: accountType })
      .eq("id", org.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("บันทึกแล้ว")
      // Refresh so sidebar/tax page picks up new account_type immediately
      router.refresh()
    }
    setSaving(false)
  }

  const handleReset = () => {
    setName(org.name ?? "")
    setTaxId(org.tax_id ?? "")
    setAddress(org.address ?? "")
    setFyEnd(org.fiscal_year_end ?? 12)
    setAccountType(org.account_type ?? "business")
  }

  return (
    <div className="p-6 lg:p-7 max-w-[900px] animate-fade-in">
      <h2 className="text-[20px] font-bold text-foreground">ตั้งค่าทั่วไป</h2>
      <p className="text-[12.5px] text-muted-foreground mt-0.5">ข้อมูลพื้นฐานของ profile นี้</p>

      {/* Main settings card */}
      <div className="mt-5 bg-card border border-border rounded-[12px] p-6 space-y-5">

        {/* ── Account Type — most important setting ── */}
        <SettingRow
          label="ประเภทบัญชี"
          hint="กำหนดประเภทภาษีที่แสดง: องค์กร = VAT/WHT, ส่วนตัว = ภ.ง.ด.90/91"
        >
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "business", label: "องค์กร / นิติบุคคล", sub: "VAT · WHT · ภ.พ.30", icon: Building2 },
              { value: "personal", label: "ส่วนตัว / บุคคลธรรมดา", sub: "ภ.ง.ด.90/91", icon: User },
            ] as const).map(({ value, label, sub, icon: Icon }) => (
              <button
                key={value}
                type="button"
                disabled={!canEdit}
                onClick={() => setAccountType(value)}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-[10px] border text-left transition-all",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  accountType === value
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 ring-2 ring-brand-500/20"
                    : "border-border hover:border-brand-300 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "mt-0.5 w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0",
                  accountType === value
                    ? "bg-brand-500/15 text-brand-600 dark:text-brand-300"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground leading-tight">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </SettingRow>

        <div className="border-t border-border" />

        <SettingRow label="ชื่อ" hint={accountType === "personal" ? "ชื่อบัญชีส่วนตัว" : "ชื่อองค์กร / บริษัท"}>
          <input
            value={name} onChange={e => setName(e.target.value)} disabled={!canEdit}
            placeholder={accountType === "personal" ? "เช่น บัญชีส่วนตัว, Freelance" : "บริษัท ABC จำกัด"}
            className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
              outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition
              disabled:opacity-60" />
        </SettingRow>

        {accountType === "business" && (
          <>
            <SettingRow label="เลขผู้เสียภาษี" hint="13 หลัก สำหรับใบกำกับภาษี">
              <input
                value={taxId}
                onChange={e => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                disabled={!canEdit} placeholder="0000000000000"
                className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
                  font-mono outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition
                  disabled:opacity-60" />
            </SettingRow>

            <SettingRow label="ที่อยู่จดทะเบียน" hint="ใช้ในการพิมพ์รายงานภาษี">
              <textarea
                rows={2} value={address} onChange={e => setAddress(e.target.value)} disabled={!canEdit}
                className="w-full rounded-[10px] border border-border bg-card text-sm text-foreground p-3
                  outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 resize-none transition
                  disabled:opacity-60" />
            </SettingRow>
          </>
        )}

        <SettingRow label="สิ้นปีบัญชี" hint="ใช้สำหรับแบ่งรอบรายงาน">
          <select
            value={fyEnd} onChange={e => setFyEnd(+e.target.value)} disabled={!canEdit}
            className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
              outline-none focus:border-brand-500 transition disabled:opacity-60">
            {[12, 6, 9, 3].map(m => (
              <option key={m} value={m}>{MONTHS[m]} ({m})</option>
            ))}
          </select>
        </SettingRow>

        {canEdit && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button onClick={handleReset}
              className="h-9 px-4 rounded-[10px] hover:bg-muted text-sm font-medium text-foreground transition-colors">
              ยกเลิก
            </button>
            <button
              onClick={handleSave} disabled={saving}
              className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium
                transition-colors disabled:opacity-60">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-5 bg-card border border-rose-500/30 rounded-[12px] p-6">
        <h3 className="text-base font-semibold text-rose-600 dark:text-rose-400">โซนอันตราย</h3>
        <p className="text-[12.5px] text-muted-foreground mt-1">
          การลบองค์กรจะลบเอกสารและการตั้งค่าทั้งหมดถาวร
        </p>
        <button
          onClick={() => toast.error("กรุณาติดต่อ support เพื่อลบองค์กร")}
          className="mt-4 h-9 px-4 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium
            transition-colors inline-flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> ลบองค์กรนี้
        </button>
      </div>
    </div>
  )
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 items-start">
      <div>
        <div className="text-[13.5px] font-medium text-foreground">{label}</div>
        {hint && <div className="text-[11.5px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}
