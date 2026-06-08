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

type HealthType =
  | "weight" | "blood_pressure_systolic" | "blood_pressure_diastolic"
  | "blood_glucose" | "steps" | "sleep_hours" | "heart_rate" | "hrv"
  | "water_ml" | "calories"

// GET — list health_entries for current user, last 30 days, optionally filter by ?type=
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const type = req.nextUrl.searchParams.get("type") as HealthType | null

  const since = new Date()
  since.setDate(since.getDate() - 30)

  let query = supabase
    .from("health_entries")
    .select("id, type, value, unit, notes, recorded_at, created_at")
    .eq("user_id", user.id)
    .gte("recorded_at", since.toISOString())
    .order("recorded_at", { ascending: false })
    .limit(200)

  if (type) {
    query = query.eq("type", type)
  }

  const { data: entries, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: entries ?? [] })
}

// POST — create health_entry
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    type:        HealthType
    value:       number
    unit?:       string
    notes?:      string
    recorded_at?: string
  }

  const { type, value, unit, notes, recorded_at } = body
  if (!type || value === undefined) {
    return NextResponse.json({ error: "type and value required" }, { status: 400 })
  }

  const { data: entry, error } = await supabase
    .from("health_entries")
    .insert({
      user_id:     user.id,
      type,
      value,
      unit:        unit ?? null,
      notes:       notes ?? null,
      recorded_at: recorded_at ?? new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: entry.id }, { status: 201 })
}

// DELETE — delete a health_entry by ?id=
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { error } = await supabase
    .from("health_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
