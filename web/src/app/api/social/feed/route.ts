/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const PAGE_SIZE = 20

// GET — personalized feed: posts from followed users, fallback to recent posts
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cursor = req.nextUrl.searchParams.get("cursor")

  // Get the list of users the current user follows
  const { data: follows, error: followsErr } = await supabase
    .from("social_follows")
    .select("following_id")
    .eq("follower_id", user.id)

  if (followsErr) return NextResponse.json({ error: followsErr.message }, { status: 500 })

  const followingIds = (follows ?? []).map(f => f.following_id)

  let query = supabase
    .from("posts")
    .select(`
      id, type, title, body, media_urls, receipt_ids,
      likes_count, comments_count, saves_count, created_at, updated_at,
      author_id,
      users!posts_author_id_fkey(id, full_name, avatar_url)
    `)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1)

  // If following anyone, filter to their posts; otherwise show all recent posts
  if (followingIds.length > 0) {
    query = query.in("author_id", followingIds)
  }

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data: posts, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = posts ?? []
  const hasMore = items.length > PAGE_SIZE
  const nextCursor = hasMore ? items[PAGE_SIZE - 1]?.created_at : null

  return NextResponse.json({
    posts:         hasMore ? items.slice(0, PAGE_SIZE) : items,
    nextCursor:    nextCursor ?? null,
    isFallbackFeed: followingIds.length === 0,
  })
}
