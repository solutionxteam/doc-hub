/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

"use client"

import { useState, useMemo } from "react"
import { toast }             from "sonner"
import { cn }                from "@/lib/utils"
import { Icons }             from "@/components/ui/icons"
import type { TrendingPost, TopCreator } from "@/app/(app)/social/discover/page"

/* ─── Constants ──────────────────────────────────────────────── */
const CATEGORIES = [
  { value: "all",        label: "ทั้งหมด"    },
  { value: "health",     label: "สุขภาพ"     },
  { value: "finance",    label: "การเงิน"    },
  { value: "food",       label: "อาหาร"      },
  { value: "supplement", label: "ซัพพลีเมนต์" },
  { value: "fitness",    label: "ฟิตเนส"     },
]

const TYPE_META: Record<string, { emoji: string; color: string; bg: string }> = {
  protocol:  { emoji: "📋", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900/30"  },
  review:    { emoji: "🧾", color: "text-blue-700 dark:text-blue-300",     bg: "bg-blue-100 dark:bg-blue-900/30"      },
  challenge: { emoji: "🎯", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900/30"  },
  stack:     { emoji: "📦", color: "text-teal-700 dark:text-teal-300",     bg: "bg-teal-100 dark:bg-teal-900/30"      },
}

/* ─── Props ──────────────────────────────────────────────────── */
type Props = {
  trending:      TrendingPost[]
  creators:      TopCreator[]
  currentUserId: string
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase()
}

/* ─── TrendingCard ───────────────────────────────────────────── */
function TrendingCard({ post }: { post: TrendingPost }) {
  const meta = TYPE_META[post.type] ?? { emoji: "📝", color: "text-foreground", bg: "bg-muted" }
  return (
    <div className="shrink-0 w-64 bg-card border border-border rounded-[14px] p-4 space-y-2.5 hover:shadow-md transition-shadow duration-200 cursor-pointer">
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", meta.bg, meta.color)}>
          {meta.emoji} {post.type}
        </span>
        {post.receipt_ids.length > 0 && (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">✅</span>
        )}
      </div>
      <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">{post.title}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{post.body}</p>
      <div className="flex items-center gap-3 pt-1 border-t border-border">
        <span className="text-xs text-muted-foreground">❤️ {post.likes_count}</span>
        <span className="text-xs text-muted-foreground">📌 {post.saves_count}</span>
        {post.longevity_score != null && (
          <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 font-medium">🌿 {post.longevity_score}</span>
        )}
      </div>
    </div>
  )
}

/* ─── CreatorCard ────────────────────────────────────────────── */
function CreatorCard({ creator, following, onFollow }: {
  creator:   TopCreator
  following: boolean
  onFollow:  (id: string) => void
}) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow duration-200">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 flex items-center justify-center text-violet-700 dark:text-violet-300 font-bold text-base overflow-hidden">
        {creator.avatar_url
          ? <img src={creator.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
          : initials(creator.display_name ?? creator.author_name)}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground truncate max-w-[120px]">
          {creator.display_name ?? creator.author_name}
        </p>
        {creator.longevity_score != null && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">🌿 {creator.longevity_score}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{creator.follower_count.toLocaleString("th-TH")} ผู้ติดตาม</p>
      </div>
      <button
        onClick={() => onFollow(creator.user_id)}
        className={cn(
          "text-xs font-semibold px-3 py-1.5 rounded-xl w-full transition-colors",
          following
            ? "bg-muted border border-violet-200 dark:border-violet-800 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 flex items-center justify-center gap-1"
            : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
        )}
      >
        {following ? (
          <>
            <Icons.Check size={12} />
            ติดตามอยู่
          </>
        ) : "ติดตาม"}
      </button>
    </div>
  )
}

/* ─── DiscoverClient ─────────────────────────────────────────── */
export function DiscoverClient({ trending, creators, currentUserId }: Props) {
  const [search,       setSearch]       = useState("")
  const [category,     setCategory]     = useState("all")
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  const filteredTrending = useMemo(() => {
    const q = search.toLowerCase()
    return trending.filter(p =>
      (!q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q))
    )
  }, [trending, search])

  const handleFollow = async (userId: string) => {
    setFollowingIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
    try {
      await fetch("/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      })
      const now = followingIds.has(userId)
      toast.success(now ? "เลิกติดตามแล้ว" : "ติดตามแล้ว!")
    } catch {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่")
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">
          ค้นพบ
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">ค้นหาเนื้อหาและผู้สร้างที่น่าสนใจ</p>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <Icons.Search size={16} />
        </span>
        <input
          type="text"
          placeholder="ค้นหาโพสต์..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={cn(
              "text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors",
              category === cat.value
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-violet-400"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Trending section */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Icons.TrendingUp size={16} className="text-violet-500" />
          Trending
          <span className="text-xs font-normal text-muted-foreground">โพสต์ยอดนิยม</span>
        </h2>
        {filteredTrending.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">ไม่พบโพสต์ที่ตรงกัน</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            {filteredTrending.map(post => (
              <TrendingCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      {/* Popular Creators */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Icons.Star size={16} className="text-violet-500" />
          Popular Creators
          <span className="text-xs font-normal text-muted-foreground">ผู้สร้างที่มีผู้ติดตามมาก</span>
        </h2>
        {creators.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">ยังไม่มีผู้สร้างเนื้อหา</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {creators.map(creator => (
              <CreatorCard
                key={creator.user_id}
                creator={creator}
                following={followingIds.has(creator.user_id)}
                onFollow={handleFollow}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
