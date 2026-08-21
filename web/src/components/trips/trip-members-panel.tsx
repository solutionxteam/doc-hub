"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { UserPlus, LogOut, MessageCircle, Crown } from "lucide-react"
import { InviteFriendModal } from "./invite-friend-modal"

export type TripMember = {
  id: string
  user_id: string | null
  display_name: string
  line_user_id: string | null
  is_host: boolean
  is_non_line: boolean
  joined_at: string
}

export function TripMembersPanel({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [members, setMembers] = useState<TripMember[] | null>(null)
  const [myRole, setMyRole] = useState<"owner" | "participant" | "none">("none")
  const [showInvite, setShowInvite] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [openingChat, setOpeningChat] = useState(false)

  const load = () => {
    fetch(`/api/trips/${tripId}/members`)
      .then(r => r.json())
      .then(d => { setMembers(d.members ?? []); setMyRole(d.myRole ?? "none") })
      .catch(() => setMembers([]))
  }
  useEffect(load, [tripId])

  const isOwner = myRole === "owner"

  const removeMember = async (member: TripMember) => {
    if (!member.user_id) return
    if (!confirm(`เอา ${member.display_name} ออกจากทริปนี้?\nประวัติค่าใช้จ่ายของเขาจะยังอยู่ แต่จะไม่เห็นทริปนี้อีกต่อไป`)) return
    setRemovingId(member.id)
    try {
      const res = await fetch(`/api/trips/${tripId}/members?userId=${member.user_id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "ลบสมาชิกไม่สำเร็จ"); return }
      toast.success(`เอา ${member.display_name} ออกจากทริปแล้ว`)
      load()
    } finally {
      setRemovingId(null)
    }
  }

  const openChat = async () => {
    setOpeningChat(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/conversation`, { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.conversationId) { toast.error(data.error ?? "เปิดแชทไม่สำเร็จ"); return }
      router.push(`/messages/${data.conversationId}`)
    } finally {
      setOpeningChat(false)
    }
  }

  if (members === null) return <div className="text-center py-10 text-sm text-muted-foreground">กำลังโหลด...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={openChat} disabled={openingChat}
          className="h-9 px-3.5 rounded-[8px] border bg-card text-sm font-medium flex items-center gap-1.5 hover:bg-muted/40 disabled:opacity-50">
          <MessageCircle className="w-4 h-4" /> {openingChat ? "กำลังเปิด..." : "เปิดแชททริป"}
        </button>
        {isOwner && (
          <button onClick={() => setShowInvite(true)}
            className="h-9 px-3.5 rounded-[8px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" /> เชิญเพื่อน
          </button>
        )}
      </div>

      <div className="rounded-xl border bg-card divide-y">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีสมาชิก</p>
        ) : members.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center font-semibold text-xs shrink-0">
              {m.display_name.trim().slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                {m.display_name}
                {m.is_host && <Crown className="w-3.5 h-3.5 text-amber-500" aria-label="เจ้าของทริป" />}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {m.user_id ? "สมาชิก Slippy" : m.line_user_id ? "เชิญผ่าน LINE" : "ไม่มีบัญชี Slippy"}
              </p>
            </div>
            {isOwner && !m.is_host && m.user_id && (
              <button onClick={() => removeMember(m)} disabled={removingId === m.id}
                className="h-8 px-2.5 rounded-[7px] text-xs font-medium text-destructive hover:bg-destructive/10 flex items-center gap-1 disabled:opacity-50">
                <LogOut className="w-3.5 h-3.5" /> {removingId === m.id ? "กำลังลบ..." : "ลบออก"}
              </button>
            )}
          </div>
        ))}
      </div>

      {showInvite && (
        <InviteFriendModal
          tripId={tripId}
          existingUserIds={members.filter(m => m.user_id).map(m => m.user_id as string)}
          onClose={() => setShowInvite(false)}
          onDone={() => { setShowInvite(false); load() }}
        />
      )}
    </div>
  )
}
