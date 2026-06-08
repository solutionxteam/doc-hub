/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient } from "@/lib/supabase/server"
import { FeedClient }   from "@/components/social/feed-client"

export const dynamic = "force-dynamic"

export type PostRow = {
  id: string
  author_id: string
  type: "protocol" | "review" | "challenge" | "stack"
  title: string
  body: string
  media_urls: string[]
  receipt_ids: string[]
  is_published: boolean
  likes_count: number
  comments_count: number
  saves_count: number
  created_at: string
  author_name: string
  author_avatar: string | null
  display_name: string | null
  longevity_score: number | null
}

export type PersonalProfileRow = {
  display_name: string | null
  bio: string | null
  longevity_score: number | null
  wealth_score: number | null
  is_public: boolean
  follower_count: number
  following_count: number
}

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ""

  const [
    { data: rawPosts },
    { data: profile },
    { count: followingCount },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(`
        id, author_id, type, title, body, media_urls, receipt_ids,
        is_published, likes_count, comments_count, saves_count, created_at,
        users!author_id ( full_name, avatar_url ),
        personal_profiles!author_id ( display_name, longevity_score )
      `)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("personal_profiles")
      .select("display_name, bio, longevity_score, wealth_score, is_public, follower_count, following_count")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("social_follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ])

  const posts: PostRow[] = (rawPosts ?? []).map((p: any) => ({
    id:             p.id,
    author_id:      p.author_id,
    type:           p.type,
    title:          p.title,
    body:           p.body,
    media_urls:     p.media_urls ?? [],
    receipt_ids:    p.receipt_ids ?? [],
    is_published:   p.is_published,
    likes_count:    p.likes_count ?? 0,
    comments_count: p.comments_count ?? 0,
    saves_count:    p.saves_count ?? 0,
    created_at:     p.created_at,
    author_name:    p.users?.full_name ?? "ผู้ใช้",
    author_avatar:  p.users?.avatar_url ?? null,
    display_name:   p.personal_profiles?.display_name ?? null,
    longevity_score: p.personal_profiles?.longevity_score ?? null,
  }))

  return (
    <FeedClient
      posts={posts}
      profile={profile ?? null}
      followingCount={followingCount ?? 0}
      currentUserId={userId}
    />
  )
}
