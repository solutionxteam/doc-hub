"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  User, Mail, Shield, LogOut, Camera, Check, Edit2,
  Bell, Smartphone, MessageCircle, Key, ChevronRight,
  Clock, FileText, CheckCircle2, AlertCircle, Loader2,
  Trash2, Building2,
} from "lucide-react"
import { toast } from "sonner"

/* ─── Types ── */
interface ActivityLog {
  id:         string
  action:     string
  detail:     string | null
  created_at: string
}

type LineConnection = {
  id:           string
  display_name: string | null
  created_at:   string
} | null

interface ProfileProps {
  userId:          string
  name:            string
  email:           string
  role:            string
  orgName:         string
  orgPlan:         string
  joinedAt?:       string
  activityLogs:    ActivityLog[]
  lineConnection:  LineConnection
}

/* ─── Helpers ── */
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

const roleLabel: Record<string, string> = {
  owner: "Owner", admin: "Admin", accountant: "Accountant",
  member: "Member", viewer: "Viewer",
}
const roleBg: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  admin: "bg-brand-500/10 text-brand-700 dark:text-brand-300",
  accountant: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  member: "bg-slate-500/10 text-slate-600",
  viewer: "bg-slate-500/10 text-slate-500",
}

// Activity label mapping from action keys
const ACTION_LABEL: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  login:                  { label: "ลงชื่อเข้าใช้",          icon: CheckCircle2, color: "text-emerald-500" },
  consent_update:         { label: "อัปเดตความยินยอม PDPA",  icon: FileText,     color: "text-brand-500"   },
  security_update:        { label: "อัปเดตการตั้งค่าความปลอดภัย", icon: Shield,  color: "text-purple-500"  },
  export_request:         { label: "ขอส่งออกข้อมูล",         icon: FileText,     color: "text-amber-500"   },
  session_revoke:         { label: "ออกจากระบบอุปกรณ์",      icon: AlertCircle,  color: "text-rose-500"    },
  session_revoke_all:     { label: "ออกจากระบบทุกอุปกรณ์",   icon: AlertCircle,  color: "text-rose-500"    },
  account_delete_request: { label: "ขอลบบัญชี",              icon: AlertCircle,  color: "text-rose-600"    },
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "เมื่อกี้"
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  const d = Math.floor(h / 24)
  return d === 1 ? "เมื่อวาน" : `${d} วันที่แล้ว`
}

/* ─── Avatar section ── */
function AvatarSection({ name }: { name: string }) {
  const [hovered, setHovered] = useState(false)
  const colors = ["from-brand-400 to-brand-700", "from-purple-400 to-brand-600", "from-rose-400 to-brand-500"]
  const grad = colors[name.length % colors.length]
  return (
    <div className="relative inline-block" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className={cn(
        "w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center",
        "text-white text-3xl font-bold select-none transition-all duration-200",
        grad,
        hovered && "opacity-80"
      )}>
        {initials(name)}
      </div>
      <button className={cn(
        "absolute inset-0 rounded-full flex items-center justify-center",
        "bg-black/40 transition-opacity duration-200",
        hovered ? "opacity-100" : "opacity-0"
      )}>
        <Camera className="w-6 h-6 text-white" />
      </button>
      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-background
        flex items-center justify-center" title="ออนไลน์">
        <span className="w-2 h-2 rounded-full bg-white" />
      </span>
    </div>
  )
}

/* ─── Edit name form ── */
function EditableField({
  label, value, icon: Icon, editable = false, onSave
}: { label: string; value: string; icon: React.FC<{className?:string}>; editable?: boolean; onSave?: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value)
  const [saving, setSaving]   = useState(false)

  const save = async () => {
    if (!onSave) return
    setSaving(true)
    await onSave(val)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors group">
      <div className="w-9 h-9 rounded-xl bg-background border flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={val}
              onChange={e => setVal(e.target.value)}
              autoFocus
              className="flex-1 text-sm font-medium bg-background border rounded-lg px-3 py-1.5 outline-none
                focus:ring-2 ring-brand-500/30"
            />
            <button
              onClick={save}
              disabled={saving}
              className="p-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => { setVal(value); setEditing(false) }}
              className="p-1.5 rounded-lg border hover:bg-muted transition-colors text-xs"
            >
              ×
            </button>
          </div>
        ) : (
          <p className="text-sm font-medium">{val}</p>
        )}
      </div>
      {editable && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted"
        >
          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

/* ─── Notification preferences ── */
function NotifPrefs() {
  const prefs = [
    { key: "doc_approved",  label: "เอกสารได้รับการอนุมัติ",   sub: "แจ้งทุกครั้งที่ approved",     def: true },
    { key: "doc_reviewing", label: "เอกสารรอตรวจสอบ",          sub: "แจ้งเมื่อต้องตรวจด้วยตนเอง", def: true },
    { key: "quota_alert",   label: "โควต้าใกล้เต็ม",           sub: "แจ้งเมื่อใช้ไป 80%",          def: true },
    { key: "weekly_report", label: "รายงานรายสัปดาห์",         sub: "สรุปค่าใช้จ่ายทุกวันจันทร์",  def: false },
    { key: "line_push",     label: "Push ผ่าน LINE Bot",        sub: "ส่งแจ้งเตือนใน LINE",         def: true },
  ]
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(prefs.map(p => [p.key, p.def]))
  )
  return (
    <div className="space-y-1.5">
      {prefs.map(p => (
        <div key={p.key} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-xs text-muted-foreground">{p.sub}</p>
          </div>
          <button
            onClick={() => setEnabled(s => ({ ...s, [p.key]: !s[p.key] }))}
            className={cn(
              "relative w-10 h-5.5 rounded-full transition-colors shrink-0",
              enabled[p.key] ? "bg-brand-500" : "bg-muted-foreground/30"
            )}
            style={{ width: 40, height: 22 }}
          >
            <span className={cn(
              "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform duration-200",
              enabled[p.key] ? "translate-x-[19px]" : "translate-x-0.5"
            )} style={{ width: 18, height: 18 }} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ─── Main component ── */
export function ProfileClient({
  userId, name, email, role, orgName, orgPlan, joinedAt, activityLogs, lineConnection,
}: ProfileProps) {
  const [tab, setTab]           = useState<"info"|"notif"|"security">("info")
  const [isPending, startTrans] = useTransition()
  const router                  = useRouter()
  const supabase                = createClient()

  const handleSaveName = async (newName: string) => {
    const { error } = await supabase.from("users").update({ full_name: newName }).eq("id", userId)
    if (error) toast.error("ไม่สามารถบันทึกชื่อได้")
    else { toast.success("บันทึกชื่อแล้ว"); router.refresh() }
  }

  const handleLogout = () => {
    startTrans(async () => {
      await supabase.auth.signOut()
      router.push("/login")
    })
  }

  const tabs = [
    { key: "info",     label: "ข้อมูลส่วนตัว" },
    { key: "notif",    label: "การแจ้งเตือน" },
    { key: "security", label: "ความปลอดภัย" },
  ] as const

  return (
    <div className="p-6 lg:p-7 max-w-[680px] animate-fade-in space-y-6">

      {/* ── Hero card ── */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Gradient banner */}
        <div className="h-28 bg-gradient-to-br from-brand-500 via-brand-600 to-purple-600 relative">
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-12 flex items-end justify-between gap-4 mb-4">
            <AvatarSection name={name} />
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border
              hover:bg-muted transition-colors mb-1">
              <Edit2 className="w-3.5 h-3.5" />
              แก้ไขโปรไฟล์
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{name}</h1>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", roleBg[role] ?? roleBg.member)}>
                {roleLabel[role] ?? role}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{email}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {orgName}
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                  orgPlan === "pro" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
                )}>
                  {orgPlan}
                </span>
              </span>
              {joinedAt && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  เข้าร่วม {new Date(joinedAt).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-muted/60 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
              tab === t.key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: ข้อมูลส่วนตัว ── */}
      {tab === "info" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">บัญชี</p>
            <EditableField label="ชื่อ-นามสกุล" value={name}  icon={User}  editable onSave={handleSaveName} />
            <EditableField label="อีเมล"         value={email} icon={Mail}             />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">องค์กรและบทบาท</p>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40">
              <div className="w-9 h-9 rounded-xl bg-background border flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">องค์กรปัจจุบัน</p>
                <p className="text-sm font-medium">{orgName}</p>
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", roleBg[role] ?? roleBg.member)}>
                {roleLabel[role] ?? role}
              </span>
            </div>
          </div>

          {/* Linked accounts — real data */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">บัญชีที่เชื่อมต่อ</p>
            {/* LINE connection */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-[#06C755]/10 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-[#06C755]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">LINE</p>
                <p className="text-xs text-muted-foreground">
                  {lineConnection
                    ? `${lineConnection.display_name ?? "@LINE"} · เชื่อมเมื่อ ${new Date(lineConnection.created_at).toLocaleDateString("th-TH", { month: "short", year: "2-digit" })}`
                    : "ยังไม่ได้เชื่อมต่อ"}
                </p>
              </div>
              <button className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                lineConnection
                  ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                  : "hover:bg-muted"
              )}>
                {lineConnection ? "ยกเลิก" : "เชื่อมต่อ"}
              </button>
            </div>
            {/* Mobile */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-brand-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Mobile App</p>
                <p className="text-xs text-muted-foreground">เร็วๆ นี้</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                เร็วๆ นี้
              </span>
            </div>
          </div>

          {/* Recent activity — real from user_activity_logs */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">กิจกรรมล่าสุด</p>
            <div className="rounded-xl border bg-card overflow-hidden divide-y">
              {activityLogs.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                  ยังไม่มีกิจกรรม
                </div>
              ) : (
                activityLogs.map((a) => {
                  const meta = ACTION_LABEL[a.action]
                  const Icon = meta?.icon ?? FileText
                  const color = meta?.color ?? "text-muted-foreground"
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <Icon className={cn("w-4 h-4 shrink-0", color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{meta?.label ?? a.action}</p>
                        {a.detail && (
                          <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{relTime(a.created_at)}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: การแจ้งเตือน ── */}
      {tab === "notif" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 flex gap-3">
            <Bell className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">ตั้งค่าการแจ้งเตือน</p>
              <p className="text-xs text-muted-foreground mt-0.5">เลือกเหตุการณ์ที่ต้องการรับการแจ้งเตือน</p>
            </div>
          </div>
          <NotifPrefs />
        </div>
      )}

      {/* ── Tab: ความปลอดภัย ── */}
      {tab === "security" && (
        <div className="space-y-4">
          {[
            {
              icon: Key,
              label: "เปลี่ยนรหัสผ่าน",
              desc: "อัปเดตรหัสผ่านของบัญชี",
              action: "เปลี่ยนรหัสผ่าน",
              variant: "normal",
            },
            {
              icon: Shield,
              label: "การยืนยันสองขั้นตอน (2FA)",
              desc: "เพิ่มความปลอดภัยด้วย OTP ทาง Email",
              action: "เปิดใช้งาน",
              variant: "normal",
            },
            {
              icon: Smartphone,
              label: "อุปกรณ์ที่เข้าสู่ระบบ",
              desc: "MacBook Pro · Chrome · กรุงเทพฯ · ตอนนี้",
              action: "ดูทั้งหมด",
              variant: "normal",
            },
          ].map(({ icon: Icon, label, desc, action, variant: _variant }) => (
            <div key={label} className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-brand-600 hover:underline cursor-pointer">{action}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}

          {/* Auth method info */}
          <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              ยืนยันตัวตนด้วย <span className="font-semibold">อีเมล + รหัสผ่าน</span> · เข้าสู่ระบบครั้งล่าสุดเมื่อกี้
            </p>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3 mt-4">
            <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Danger Zone</p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">ลบบัญชี</p>
                <p className="text-xs text-muted-foreground">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30
                rounded-lg hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                ลบบัญชี
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logout ── */}
      <div className="pt-2 border-t">
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="flex items-center gap-2 text-sm font-medium text-rose-500 hover:text-rose-600
            transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
