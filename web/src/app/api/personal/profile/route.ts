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

// GET — fetch personal profile for current user (creates default if not exists)
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile, error } = await supabase
    .from("personal_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!profile) {
    // Create default profile
    const { data: created, error: createErr } = await supabase
      .from("personal_profiles")
      .insert({
        user_id:      user.id,
        display_name: user.email?.split("@")[0] ?? null,
      })
      .select("*")
      .single()

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
    return NextResponse.json({ profile: created })
  }

  return NextResponse.json({ profile })
}

// PUT — update personal profile
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    display_name?: string
    bio?:          string
    avatar_url?:   string
    is_public?:    boolean
  }

  const { error } = await supabase
    .from("personal_profiles")
    .upsert({
      user_id: user.id,
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
