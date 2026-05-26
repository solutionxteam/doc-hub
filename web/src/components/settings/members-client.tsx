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
import { Plus, Trash2, X, Mail, MoreHorizontal } from "lucide-react"
import { formatDate, cn } from "@/lib/utils"

interface Props {
  orgId: string; members: any[]; invitations: any[]
  currentUserId: string; userRole: string
}

const ROLE_LABEL: Record<string, string> = {
  owner:      "เจ้าของ",
  admin:      "ผู้ดูแล",
  accountant: "นักบัญชี",
  member:     "สมาชิก",
  viewer:     "ผู้ชม",
}
const ROLE_TONE: Record<string, string> = {
  owner:      "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  admin:      "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300",
  accountant: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  member:     "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  viewer:     "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
}

export function MembersClient({ orgId, members, invitations, currentUserId: _currentUserId, userRole }: Props) {
  const supabase  = createClient()
  const canManage = ["owner", "admin"].includes(userRole)

  const displayMembers = members

  const [email,    setEmail]    = useState("")
  const [role,     setRole]     = useState("accountant")
  const [inviting, setInviting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [localInvites, setLocalInvites] = useState(invitations)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    const { data, error } = await supabase
      .from("invitations")
      .insert({ organization_id: orgId, email, role })
      .select().single()
    if (error) { toast.error(error.message); setInviting(false); return }
    setLocalInvites(prev => [...prev, data])
    setEmail("")
    setShowModal(false)
    toast.success(`ส่งคำเชิญไปที่ ${email} แล้ว`)
    setInviting(false)
  }

  const handleRemove = async (memberId: string) => {
    await supabase.from("organization_members").delete().eq("id", memberId)
    toast.success("ลบสมาชิกแล้ว")
  }

  return (
    <div className="p-6 lg:p-7 max-w-[1100px] space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold text-foreground">สมาชิกในองค์กร</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            จัดการสิทธิ์การเข้าถึงและบทบาทของผู้ใช้
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium
              transition-colors inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> เชิญสมาชิก
          </button>
        )}
      </div>

      {/* Members table */}
      <div className="bg-card border border-border rounded-[12px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-3 font-medium">ผู้ใช้</th>
              <th className="text-left px-3 py-3 font-medium">บทบาท</th>
              <th className="text-left px-3 py-3 font-medium">เข้าร่วม</th>
              <th className="text-left px-3 py-3 font-medium">เข้าใช้ล่าสุด</th>
              <th className="text-right pr-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayMembers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-[13px] font-medium text-foreground">ยังไม่มีสมาชิกในองค์กร</p>
                    <p className="text-[12px] text-muted-foreground">เชิญสมาชิกเพื่อเริ่มทำงานร่วมกัน</p>
                  </div>
                </td>
              </tr>
            )}
            {displayMembers.map((m: any) => {
              const name     = m.name ?? m.users?.full_name ?? m.users?.email ?? "—"
              const email    = m.email ?? m.users?.email ?? "—"
              const avatar   = name[0]?.toUpperCase() ?? "?"
              const joined   = m.joined ?? m.joined_at
              const lastAct  = m.lastActive ?? "—"
              const mRole    = m.role ?? "member"
              return (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-700
                        text-white flex items-center justify-center font-semibold text-sm shrink-0">
                        {avatar}
                      </span>
                      <div>
                        <div className="font-medium text-foreground">{name}</div>
                        <div className="text-[12px] text-muted-foreground">{email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
                      ROLE_TONE[mRole] ?? ROLE_TONE.member
                    )}>
                      {ROLE_LABEL[mRole] ?? mRole}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-[13px]">
                    {joined ? formatDate(joined) : "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-[13px]">{lastAct}</td>
                  <td className="px-3 py-3 pr-5 text-right">
                    <button
                      onClick={() => canManage && mRole !== "owner" && handleRemove(m.id)}
                      className="h-8 w-8 rounded-[6px] hover:bg-muted inline-flex items-center
                      justify-center text-muted-foreground transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {localInvites.length > 0 && (
        <div className="bg-card border border-border rounded-[12px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-[14px] font-semibold text-foreground">
              รอตอบรับ ({localInvites.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {localInvites.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  {inv.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                  <p className="text-[12px] text-muted-foreground">
                    หมดอายุ: {formatDate(inv.expires_at)}
                  </p>
                </div>
                <span className={cn(
                  "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
                  ROLE_TONE[inv.role] ?? ROLE_TONE.member
                )}>
                  {ROLE_LABEL[inv.role] ?? inv.role}
                </span>
                <button
                  onClick={() => {
                    supabase.from("invitations").delete().eq("id", inv.id)
                    setLocalInvites(p => p.filter((i: any) => i.id !== inv.id))
                    toast.success("ยกเลิก invitation แล้ว")
                  }}
                  className="p-1.5 rounded-[6px] hover:bg-muted text-muted-foreground
                    hover:text-rose-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-card border border-border rounded-[16px] shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[17px] font-semibold text-foreground">เชิญสมาชิกใหม่</h3>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5">ส่งคำเชิญผ่านอีเมล</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center
                    text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">อีเมล</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full h-10 pl-9 pr-3 rounded-[10px] border border-border bg-background
                        text-sm text-foreground outline-none focus:border-brand-500
                        focus:ring-2 focus:ring-brand-500/15 transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">บทบาท</label>
                  <select
                    value={role} onChange={e => setRole(e.target.value)}
                    className="w-full h-10 rounded-[10px] border border-border bg-card text-sm
                      text-foreground px-3 outline-none focus:border-brand-500 transition">
                    <option value="admin">ผู้ดูแล (Admin)</option>
                    <option value="accountant">นักบัญชี (Accountant)</option>
                    <option value="member">สมาชิก (Member)</option>
                  </select>
                </div>
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="h-9 px-4 rounded-[10px] hover:bg-muted text-sm font-medium
                      text-foreground transition-colors">
                    ยกเลิก
                  </button>
                  <button type="submit" disabled={inviting}
                    className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white
                      text-sm font-medium transition-colors disabled:opacity-60">
                    {inviting ? "กำลังส่ง..." : "ส่งคำเชิญ"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
