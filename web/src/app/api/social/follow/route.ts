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

// POST — follow a user
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { targetUserId } = await req.json() as { targetUserId: string }
  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 })
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 })
  }

  const { error } = await supabase
    .from("social_follows")
    .upsert({
      follower_id:  user.id,
      following_id: targetUserId,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Increment follower_count on target profile, following_count on own profile
  await supabase.rpc("increment_follow_counts", {
    p_follower_id:  user.id,
    p_following_id: targetUserId,
  }).maybeSingle()

  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE — unfollow a user
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { targetUserId } = await req.json() as { targetUserId: string }
  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 })

  const { error } = await supabase
    .from("social_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Decrement counts
  await supabase.rpc("decrement_follow_counts", {
    p_follower_id:  user.id,
    p_following_id: targetUserId,
  }).maybeSingle()

  return NextResponse.json({ ok: true })
}
