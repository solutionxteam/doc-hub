"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { X, Check, Search } from "lucide-react"

type Friend = { id: string; full_name: string; avatar_url: string | null }

export function InviteFriendModal({
  tripId,
  existingUserIds,
  onClose,
  onDone,
}: {
  tripId: string
  existingUserIds: string[]
  onClose: () => void
  onDone: () => void
}) {
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/friends")
      .then(r => r.json())
      .then(d => {
        const already = new Set(existingUserIds)
        const list: Friend[] = (d.friends ?? [])
          .map((f: { friend: Friend }) => f.friend)
          .filter((f: Friend) => f && !already.has(f.id))
        setFriends(list)
      })
      .catch(() => setFriends([]))
    // existingUserIds is fixed for the lifetime of one modal open (snapshotted
    // by the parent when it renders this component) — re-running on every
    // parent re-render would refetch mid-selection and drop the user's picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "เชิญเพื่อนไม่สำเร็จ"); return }
      toast.success(
        data.invited.length > 0 ? `เชิญ ${data.invited.length} คนเข้าทริปแล้ว` : "ทุกคนอยู่ในทริปนี้อยู่แล้ว",
      )
      onDone()
    } finally {
      setSaving(false)
    }
  }

  const shown = (friends ?? []).filter(f => f.full_name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto border shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold">เชิญเพื่อนเข้าทริป</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground" aria-label="ปิด">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 pb-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="ค้นหาเพื่อน..."
              className="w-full h-10 pl-9 pr-3 rounded-[8px] border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="p-4 space-y-1 min-h-[120px]">
          {friends === null ? (
            <p className="text-sm text-muted-foreground text-center py-8">กำลังโหลด...</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {friends.length === 0 ? "เพื่อนทุกคนอยู่ในทริปนี้แล้ว หรือยังไม่มีเพื่อนใน Slippy" : "ไม่พบเพื่อนที่ค้นหา"}
            </p>
          ) : shown.map(f => {
            const isSelected = selected.has(f.id)
            return (
              <button key={f.id} onClick={() => toggle(f.id)}
                className={cn("w-full flex items-center gap-3 px-2 py-2 rounded-[8px] text-left transition-colors",
                  isSelected ? "bg-brand-50 dark:bg-brand-900/30" : "hover:bg-muted/50")}>
                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden">
                  {f.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={f.avatar_url} alt={f.full_name} className="w-full h-full object-cover" />
                    : f.full_name.trim().slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium truncate">{f.full_name}</span>
                <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0",
                  isSelected ? "bg-brand-500 border-brand-500" : "border-muted-foreground/30")}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            )
          })}
        </div>

        <div className="p-4 pt-2 border-t">
          <button onClick={submit} disabled={selected.size === 0 || saving}
            className="w-full h-11 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold">
            {saving ? "กำลังเชิญ..." : selected.size > 0 ? `เชิญ ${selected.size} คน` : "เลือกเพื่อนที่ต้องการเชิญ"}
          </button>
        </div>
      </div>
    </div>
  )
}
