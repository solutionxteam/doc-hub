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
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

interface Props { org: any; userRole: string }

const MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

export function SettingsForm({ org, userRole }: Props) {
  const supabase = createClient()
  const canEdit  = ["owner", "admin"].includes(userRole)

  const [name,    setName]    = useState(org.name           ?? "")
  const [taxId,   setTaxId]   = useState(org.tax_id         ?? "")
  const [address, setAddress] = useState(org.address        ?? "")
  const [fyEnd,   setFyEnd]   = useState(org.fiscal_year_end ?? 12)
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from("organizations")
      .update({ name, tax_id: taxId, address, fiscal_year_end: fyEnd })
      .eq("id", org.id)
    if (error) toast.error(error.message)
    else toast.success("บันทึกแล้ว")
    setSaving(false)
  }

  return (
    <div className="p-6 lg:p-7 max-w-[900px] animate-fade-in">
      <h2 className="text-[20px] font-bold text-foreground">ตั้งค่าทั่วไป</h2>
      <p className="text-[12.5px] text-muted-foreground mt-0.5">ข้อมูลพื้นฐานขององค์กรนี้</p>

      {/* Main settings card */}
      <div className="mt-5 bg-card border border-border rounded-[12px] p-6 space-y-5">
        <SettingRow label="ชื่อองค์กร" hint="แสดงผลในแอปและในใบกำกับ">
          <input
            value={name} onChange={e => setName(e.target.value)} disabled={!canEdit}
            className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
              outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition
              disabled:opacity-60" />
        </SettingRow>

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
            <button
              onClick={() => { setName(org.name ?? ""); setTaxId(org.tax_id ?? ""); setAddress(org.address ?? "") }}
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
