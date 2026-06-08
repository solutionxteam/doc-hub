/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

"use client"

import { useState, useCallback } from "react"
import Link                       from "next/link"
import { toast }                  from "sonner"
import { cn }                     from "@/lib/utils"
import { Icons }                  from "@/components/ui/icons"
import type { PostRow, PersonalProfileRow } from "@/app/(app)/social/page"

/* ─── Types ──────────────────────────────────────────────────── */
type Tab = "all" | "protocol" | "review" | "challenge" | "stack"

type Props = {
  posts:          PostRow[]
  profile:        PersonalProfileRow | null
  followingCount: number
  currentUserId:  string
}

/* ─── Constants ──────────────────────────────────────────────── */
const TAB_LABELS: { value: Tab; label: string }[] = [
  { value: "all",       label: "ทั้งหมด"   },
  { value: "protocol",  label: "Protocol"  },
  { value: "review",    label: "Review"    },
  { value: "challenge", label: "Challenge" },
  { value: "stack",     label: "Stack"     },
]

const TYPE_META: Record<
  PostRow["type"],
  { emoji: string; label: string; color: string; bg: string }
> = {
  protocol:  { emoji: "📋", label: "Protocol",  color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900/30"  },
  review:    { emoji: "🧾", label: "Review",    color: "text-blue-700 dark:text-blue-300",     bg: "bg-blue-100 dark:bg-blue-900/30"      },
  challenge: { emoji: "🎯", label: "Challenge", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900/30"  },
  stack:     { emoji: "📦", label: "Stack",     color: "text-teal-700 dark:text-teal-300",     bg: "bg-teal-100 dark:bg-teal-900/30"      },
}

/* ─── Helpers ────────────────────────────────────────────────── */
function timeAgoThai(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return "เมื่อกี้"
  if (mins  < 60) return `${mins} นาทีที่แล้ว`
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  if (days  < 30) return `${days} วันที่แล้ว`
  return new Date(isoStr).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase()
}

/* ─── PostCard ───────────────────────────────────────────────── */
function PostCard({
  post,
  likedIds,
  savedIds,
  onLike,
  onSave,
  onShare,
}: {
  post:     PostRow
  likedIds: Set<string>
  savedIds: Set<string>
  onLike:   (id: string) => void
  onSave:   (id: string) => void
  onShare:  (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta  = TYPE_META[post.type]
  const liked = likedIds.has(post.id)
  const saved = savedIds.has(post.id)

  return (
    <div className="bg-card border border-border rounded-[14px] p-5 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-3">
      {/* Author row */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 flex items-center justify-center text-violet-700 dark:text-violet-300 font-bold text-sm shrink-0 overflow-hidden">
          {post.author_avatar
            ? <img src={post.author_avatar} alt="" className="w-full h-full object-cover rounded-full" />
            : initials(post.display_name ?? post.author_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {post.display_name ?? post.author_name}
          </p>
          <p className="text-xs text-muted-foreground">{timeAgoThai(post.created_at)}</p>
        </div>
        {/* Longevity badge */}
        {post.longevity_score != null && (
          <span className="shrink-0 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
            🌿 {post.longevity_score}
          </span>
        )}
      </div>

      {/* Type badge + Verified badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full", meta.bg, meta.color)}>
          {meta.emoji} {meta.label}
        </span>
        {post.receipt_ids.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700">
            ✅ Verified Purchase
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-foreground leading-snug">{post.title}</h3>

      {/* Body */}
      <div className="relative">
        <p
          className={cn(
            "text-sm text-muted-foreground leading-relaxed whitespace-pre-line",
            !expanded && "line-clamp-3"
          )}
        >
          {post.body}
        </p>
        {!expanded && post.body.length > 200 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-violet-600 dark:text-violet-400 font-medium mt-0.5 hover:underline"
          >
            อ่านต่อ
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-border">
        <button
          onClick={() => onLike(post.id)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors",
            liked
              ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              : "hover:bg-muted text-muted-foreground"
          )}
        >
          {liked ? "❤️" : "🤍"} {post.likes_count + (liked ? 1 : 0)}
        </button>
        <button
          onClick={() => onSave(post.id)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors",
            saved
              ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
              : "hover:bg-muted text-muted-foreground"
          )}
        >
          {saved ? "🔖" : "📌"} {post.saves_count + (saved ? 1 : 0)}
        </button>
        <button
          onClick={() => onShare(post.id)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors ml-auto"
        >
          🔗 แชร์
        </button>
      </div>
    </div>
  )
}

/* ─── FeedClient ─────────────────────────────────────────────── */
export function FeedClient({ posts, profile, followingCount, currentUserId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("all")
  const [likedIds,  setLikedIds]  = useState<Set<string>>(new Set())
  const [savedIds,  setSavedIds]  = useState<Set<string>>(new Set())

  const filtered = activeTab === "all"
    ? posts
    : posts.filter(p => p.type === activeTab)

  const handleLike = useCallback(async (postId: string) => {
    setLikedIds(prev => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
    try {
      await fetch("/api/social/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, type: "like" }),
      })
    } catch {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่")
    }
  }, [])

  const handleSave = useCallback(async (postId: string) => {
    setSavedIds(prev => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
    try {
      await fetch("/api/social/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, type: "save" }),
      })
    } catch {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่")
    }
  }, [])

  const handleShare = useCallback((postId: string) => {
    const url = `${window.location.origin}/social/post/${postId}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success("คัดลอกลิงก์แล้ว!")
    }).catch(() => {
      toast.error("ไม่สามารถคัดลอกได้")
    })
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">
            Vita Social
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            ติดตาม {followingCount} คน
            {profile?.display_name ? ` · ${profile.display_name}` : ""}
          </p>
        </div>
        <Link
          href="/social/create"
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-sm"
        >
          <Icons.PenLine size={15} />
          สร้าง Post
        </Link>
      </div>

      {/* Tab filter */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto scrollbar-none">
        {TAB_LABELS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
              activeTab === tab.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-4xl">📝</p>
          <p className="text-base font-semibold text-foreground">ยังไม่มีโพสต์</p>
          <p className="text-sm text-muted-foreground">เป็นคนแรกที่แชร์ประสบการณ์!</p>
          <Link
            href="/social/create"
            className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl transition-all"
          >
            <Icons.PenLine size={15} />
            สร้าง Post แรก
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              likedIds={likedIds}
              savedIds={savedIds}
              onLike={handleLike}
              onSave={handleSave}
              onShare={handleShare}
            />
          ))}
        </div>
      )}
    </div>
  )
}
