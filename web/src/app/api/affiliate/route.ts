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

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
const CODE_LENGTH = 8

function generateCode(): string {
  let code = ""
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

// GET — list affiliate_links for current user
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: links, error } = await supabase
    .from("affiliate_links")
    .select(`
      id, code, clicks, conversions, earnings, created_at,
      products(id, name, price, image_url, category, commission_rate)
    `)
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: links ?? [] })
}

// POST — create affiliate link for a product
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { productId } = await req.json() as { productId: string }
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 })

  // Verify product exists and is active
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle()

  if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 })
  if (!product) return NextResponse.json({ error: "Product not found or inactive" }, { status: 404 })

  // Check if user already has a link for this product
  const { data: existing } = await supabase
    .from("affiliate_links")
    .select("id, code")
    .eq("creator_id", user.id)
    .eq("product_id", productId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id, code: existing.code, alreadyExists: true })
  }

  // Generate a unique code (retry up to 5 times on collision)
  let code = ""
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode()
    const { data: collision } = await supabase
      .from("affiliate_links")
      .select("id")
      .eq("code", candidate)
      .maybeSingle()
    if (!collision) {
      code = candidate
      break
    }
  }

  if (!code) {
    return NextResponse.json({ error: "Failed to generate unique code, please try again" }, { status: 500 })
  }

  const { data: link, error } = await supabase
    .from("affiliate_links")
    .insert({
      creator_id: user.id,
      product_id: productId,
      code,
    })
    .select("id, code")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: link.id, code: link.code }, { status: 201 })
}
