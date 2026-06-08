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

type PostType = "protocol" | "review" | "challenge" | "stack"

const PAGE_SIZE = 20

// GET ?cursor= — list published posts, paginated
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cursor = req.nextUrl.searchParams.get("cursor")

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

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data: posts, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = posts ?? []
  const hasMore = items.length > PAGE_SIZE
  const nextCursor = hasMore ? items[PAGE_SIZE - 1]?.created_at : null

  return NextResponse.json({
    posts:      hasMore ? items.slice(0, PAGE_SIZE) : items,
    nextCursor: nextCursor ?? null,
  })
}

// POST — create post
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    type:        PostType
    title?:      string
    body:        string
    media_urls?: string[]
    receipt_ids?: string[]
  }

  const { type, title, body: postBody, media_urls, receipt_ids } = body
  if (!type || !postBody) {
    return NextResponse.json({ error: "type and body required" }, { status: 400 })
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id:   user.id,
      type,
      title:       title ?? null,
      body:        postBody,
      media_urls:  media_urls ?? [],
      receipt_ids: receipt_ids ?? [],
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: post.id }, { status: 201 })
}

// DELETE ?id= — delete own post
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .eq("author_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
