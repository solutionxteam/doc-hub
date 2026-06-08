/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient } from "@/lib/supabase/server"
import { ShopClient }   from "@/components/shop/shop-client"

export const dynamic = "force-dynamic"

export type Product = {
  id:              string
  merchant_id:     string
  name:            string
  description:     string | null
  price:           number
  image_url:       string | null
  category:        string | null
  health_tags:     string[]
  commission_rate: number
  is_active:       boolean
}

export type AffiliateLink = {
  id:          string
  product_id:  string
  code:        string
  clicks:      number
  conversions: number
  earnings:    number
}

export default async function ShopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ""

  const [
    { data: rawProducts },
    { data: rawLinks },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, merchant_id, name, description, price, image_url, category, health_tags, commission_rate, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(50),
    supabase
      .from("affiliate_links")
      .select("id, product_id, code, clicks, conversions, earnings")
      .eq("creator_id", userId),
  ])

  const products: Product[] = (rawProducts ?? []).map((p: any) => ({
    id:              p.id,
    merchant_id:     p.merchant_id,
    name:            p.name,
    description:     p.description ?? null,
    price:           Number(p.price ?? 0),
    image_url:       p.image_url ?? null,
    category:        p.category ?? null,
    health_tags:     p.health_tags ?? [],
    commission_rate: Number(p.commission_rate ?? 0),
    is_active:       p.is_active,
  }))

  const affiliateLinks: AffiliateLink[] = (rawLinks ?? []).map((l: any) => ({
    id:          l.id,
    product_id:  l.product_id,
    code:        l.code,
    clicks:      l.clicks ?? 0,
    conversions: l.conversions ?? 0,
    earnings:    Number(l.earnings ?? 0),
  }))

  return (
    <ShopClient
      products={products}
      affiliateLinks={affiliateLinks}
    />
  )
}
