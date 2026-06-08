/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient }    from "@/lib/supabase/server"
import { DiscoverClient }  from "@/components/social/discover-client"

export const dynamic = "force-dynamic"

export type TrendingPost = {
  id:             string
  type:           "protocol" | "review" | "challenge" | "stack"
  title:          string
  body:           string
  likes_count:    number
  saves_count:    number
  receipt_ids:    string[]
  created_at:     string
  author_name:    string
  display_name:   string | null
  longevity_score: number | null
}

export type TopCreator = {
  user_id:         string
  author_name:     string
  display_name:    string | null
  longevity_score: number | null
  follower_count:  number
  post_count:      number
  avatar_url:      string | null
}

export type CategoryStat = {
  type:  string
  count: number
}

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ""

  const [
    { data: rawTrending },
    { data: rawCreators },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(`
        id, type, title, body, likes_count, saves_count, receipt_ids, created_at,
        users!author_id ( full_name, avatar_url ),
        personal_profiles!author_id ( display_name, longevity_score )
      `)
      .eq("is_published", true)
      .order("likes_count", { ascending: false })
      .limit(10),
    supabase
      .from("personal_profiles")
      .select(`
        user_id, display_name, longevity_score, follower_count,
        users!user_id ( full_name, avatar_url )
      `)
      .eq("is_public", true)
      .order("follower_count", { ascending: false })
      .limit(12),
  ])

  const trending: TrendingPost[] = (rawTrending ?? []).map((p: any) => ({
    id:              p.id,
    type:            p.type,
    title:           p.title,
    body:            p.body,
    likes_count:     p.likes_count ?? 0,
    saves_count:     p.saves_count ?? 0,
    receipt_ids:     p.receipt_ids ?? [],
    created_at:      p.created_at,
    author_name:     p.users?.full_name ?? "ผู้ใช้",
    display_name:    p.personal_profiles?.display_name ?? null,
    longevity_score: p.personal_profiles?.longevity_score ?? null,
  }))

  const creators: TopCreator[] = (rawCreators ?? []).map((c: any) => ({
    user_id:         c.user_id,
    author_name:     c.users?.full_name ?? "ผู้ใช้",
    display_name:    c.display_name ?? null,
    longevity_score: c.longevity_score ?? null,
    follower_count:  c.follower_count ?? 0,
    post_count:      0,
    avatar_url:      c.users?.avatar_url ?? null,
  }))

  return (
    <DiscoverClient
      trending={trending}
      creators={creators}
      currentUserId={userId}
    />
  )
}
