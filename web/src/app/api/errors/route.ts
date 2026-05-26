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

export interface ClientErrorPayload {
  error_type:      string          // 'heic_conversion' | 'upload' | 'camera' | 'ocr' | 'unknown'
  error_name?:     string          // e.g. 'TypeError', 'NotAllowedError'
  error_message?:  string
  error_stack?:    string
  context?:        Record<string, unknown>
  // { file_name, file_size, file_type, mime_type, strategy,
  //   browser_ua, platform, app_version }
}

// POST /api/errors — log a client-side error
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Allow anonymous logging (user might not be logged in yet)

  const body: ClientErrorPayload = await req.json().catch(() => ({}))

  if (!body.error_type) {
    return NextResponse.json({ error: "error_type required" }, { status: 400 })
  }

  // Enrich context with server-side info
  const enrichedContext = {
    ...body.context,
    ip:          req.headers.get("x-forwarded-for") ?? "unknown",
    timestamp:   new Date().toISOString(),
    app_version: process.env.npm_package_version ?? "unknown",
  }

  // Get org if logged in
  let orgId: string | null = null
  if (user) {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()
    orgId = m?.organization_id ?? null
  }

  const { data, error } = await supabase
    .from("client_error_logs")
    .insert({
      user_id:         user?.id ?? null,
      organization_id: orgId,
      error_type:      body.error_type,
      error_name:      body.error_name   ?? null,
      error_message:   body.error_message ?? null,
      error_stack:     body.error_stack  ?? null,
      context:         enrichedContext,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[error-log] insert failed:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id })
}

// GET /api/errors — fetch unresolved errors (internal use / admin)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const errorType = searchParams.get("type")
  const limit     = Math.min(Number(searchParams.get("limit") ?? "50"), 200)

  let query = supabase
    .from("client_error_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (errorType) query = query.eq("error_type", errorType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ errors: data ?? [] })
}
