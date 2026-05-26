/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }        from "@/lib/supabase/server"

const API_BASE     = process.env.API_BASE_URL    ?? "http://localhost:4000"
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

/** Compute WHT from documents table for a given org/year/month */
async function computeFromSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  year: number,
  month: number,
) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to   = new Date(year, month, 0).toISOString().split("T")[0]

  const { data } = await supabase
    .from("documents")
    .select("doc_date, vendor_name, total_amount, wht_rate, wht_amount")
    .eq("organization_id", orgId)
    .gte("doc_date", from)
    .lte("doc_date", to)
    .not("wht_amount", "is", null)
    .gt("wht_amount", 0)
    .order("doc_date", { ascending: false })

  const items = (data ?? []).map(r => ({
    date:   r.doc_date,
    payer:  r.vendor_name ?? "ไม่ระบุ",
    amount: r.total_amount ?? 0,
    rate:   r.wht_rate ?? 0,
    tax:    r.wht_amount ?? 0,
  }))

  return {
    items,
    total_base: items.reduce((s, i) => s + i.amount, 0),
    total_wht:  items.reduce((s, i) => s + i.tax, 0),
  }
}

/** GET /api/tax/wht?orgId=...&year=2026&month=5 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgId  = searchParams.get("orgId") ?? ""
  const year   = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()))
  const month  = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))

  // Try external API first
  try {
    const qs = searchParams.toString()
    const res = await fetch(`${API_BASE}/tax/wht${qs ? `?${qs}` : ""}`, {
      headers: {
        "x-internal-key": INTERNAL_KEY,
        "x-user-id":      user.id,
      },
      signal: AbortSignal.timeout(3000),
    })
    const text = await res.text()
    if (text) {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: res.status })
    }
  } catch {
    // External API unavailable — fall through to Supabase
  }

  // Supabase fallback
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  const data = await computeFromSupabase(supabase, orgId, year, month)
  return NextResponse.json(data)
}

/** POST /api/tax/wht/export — Excel download */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()

    const res = await fetch(`${API_BASE}/tax/wht/export`, {
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        "x-internal-key": INTERNAL_KEY,
        "x-user-id":      user.id,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })

    const blob = await res.blob()
    return new NextResponse(blob, {
      status: res.status,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": res.headers.get("Content-Disposition") ?? 'attachment; filename="wht.xlsx"',
      },
    })
  } catch (err: any) {
    console.error("[/api/tax/wht/export] Backend unreachable:", err.message)
    return NextResponse.json({ error: "Export service unavailable" }, { status: 503 })
  }
}
