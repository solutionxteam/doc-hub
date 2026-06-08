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

const PAGE_SIZE = 24

// GET ?q=&category=&page= — list active products with optional search
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q        = req.nextUrl.searchParams.get("q") ?? ""
  const category = req.nextUrl.searchParams.get("category")
  const page     = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10))

  let query = supabase
    .from("products")
    .select("id, name, description, price, image_url, category, health_tags, commission_rate, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (q) {
    query = query.ilike("name", `%${q}%`)
  }

  if (category) {
    query = query.eq("category", category)
  }

  const { data: products, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: products ?? [], page })
}

// POST — create product (user must own an org)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Check that the user is an owner/admin of at least one org
  const { data: membership, error: memErr } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle()

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })
  if (!membership) {
    return NextResponse.json({ error: "Forbidden: must be org owner or admin" }, { status: 403 })
  }

  const body = await req.json() as {
    name:             string
    description?:     string
    price?:           number
    image_url?:       string
    category?:        string
    health_tags?:     string[]
    commission_rate?: number
    merchant_id?:     string
  }

  const { name, description, price, image_url, category, health_tags, commission_rate, merchant_id } = body
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })

  // Use provided merchant_id or fall back to the user's org
  const resolvedMerchantId = merchant_id ?? membership.organization_id

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      merchant_id:     resolvedMerchantId,
      name,
      description:     description ?? null,
      price:           price ?? null,
      image_url:       image_url ?? null,
      category:        category ?? null,
      health_tags:     health_tags ?? [],
      commission_rate: commission_rate ?? 5.0,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: product.id }, { status: 201 })
}
