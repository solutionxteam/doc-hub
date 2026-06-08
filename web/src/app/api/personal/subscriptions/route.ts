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

// GET — list detected_subscriptions for current user
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: subscriptions, error } = await supabase
    .from("detected_subscriptions")
    .select("id, vendor_name, estimated_amount, frequency, next_due_date, last_seen_at, is_confirmed, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subscriptions: subscriptions ?? [] })
}

// POST — confirm or dismiss a subscription
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { id: string; confirmed: boolean }
  const { id, confirmed } = body
  if (!id || confirmed === undefined) {
    return NextResponse.json({ error: "id and confirmed required" }, { status: 400 })
  }

  if (!confirmed) {
    // Dismiss = delete
    const { error } = await supabase
      .from("detected_subscriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: "dismissed" })
  }

  // Confirm = set is_confirmed = true
  const { error } = await supabase
    .from("detected_subscriptions")
    .update({ is_confirmed: true })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, action: "confirmed" })
}
