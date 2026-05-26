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
import { getMembership } from "@/lib/get-membership"

// GET /api/notifications?limit=20&unread_only=false
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit      = Math.min(Number(searchParams.get("limit") ?? "30"), 100)
  const unreadOnly = searchParams.get("unread_only") === "true"

  let { organization_id: orgId } = await getMembership().catch(() => ({ organization_id: null }))

  let query = supabase
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${user.id}${orgId ? `,organization_id.eq.${orgId}` : ""}`)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.is("read_at", null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unreadCount = (data ?? []).filter(n => !n.read_at).length

  return NextResponse.json({ notifications: data ?? [], unreadCount })
}

// PATCH /api/notifications  — mark all read (or specific id)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json().catch(() => ({}))
  const now = new Date().toISOString()

  let query = supabase
    .from("notifications")
    .update({ read_at: now })
    .is("read_at", null)

  if (id) {
    query = query.eq("id", id)
  } else {
    // Mark ALL unread for this user/org
    const { organization_id: orgId } = await getMembership().catch(() => ({ organization_id: null }))
    query = query.or(`user_id.eq.${user.id}${orgId ? `,organization_id.eq.${orgId}` : ""}`)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
