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

type VatMonth = {
  year:    number
  month:   number
  input:   { vat: number; base: number }
  output:  { vat: number; base: number }
  net_vat: number
  due_date: string | null
}

/** Compute VAT from the documents table for a given org/year/month */
async function computeFromSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  year: number,
  month: number,
): Promise<VatMonth> {
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to   = new Date(year, month, 0).toISOString().split("T")[0] // last day of month

  const [inputRes, outputRes] = await Promise.all([
    // Input VAT = ภาษีซื้อ (expenses with VAT)
    supabase
      .from("documents")
      .select("vat_amount, total_amount")
      .eq("organization_id", orgId)
      .in("doc_type", ["expense", "receipt"])
      .eq("vat_claimable", true)
      .gte("doc_date", from)
      .lte("doc_date", to)
      .not("vat_amount", "is", null),

    // Output VAT = ภาษีขาย (invoices we issued)
    supabase
      .from("documents")
      .select("vat_amount, total_amount")
      .eq("organization_id", orgId)
      .in("doc_type", ["invoice", "tax_invoice", "tax_invoice_full", "tax_invoice_simplified"])
      .gte("doc_date", from)
      .lte("doc_date", to)
      .not("vat_amount", "is", null),
  ])

  const inputVat  = (inputRes.data ?? []).reduce((s, r) => s + (r.vat_amount ?? 0), 0)
  const inputBase = (inputRes.data ?? []).reduce((s, r) => s + ((r.total_amount ?? 0) - (r.vat_amount ?? 0)), 0)
  const outVat    = (outputRes.data ?? []).reduce((s, r) => s + (r.vat_amount ?? 0), 0)
  const outBase   = (outputRes.data ?? []).reduce((s, r) => s + ((r.total_amount ?? 0) - (r.vat_amount ?? 0)), 0)

  // PP.30 due date = 15th of following month
  const due = new Date(year, month, 15)
  const dueStr = due.toISOString().split("T")[0]

  return {
    year,
    month,
    input:   { vat: Math.round(inputVat * 100) / 100, base: Math.round(inputBase * 100) / 100 },
    output:  { vat: Math.round(outVat * 100) / 100,   base: Math.round(outBase * 100) / 100 },
    net_vat: Math.round((outVat - inputVat) * 100) / 100,
    due_date: dueStr,
  }
}

/** GET /api/tax/vat?orgId=...&year=2026&month=5[&history=5] */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orgId   = searchParams.get("orgId") ?? ""
  const year    = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()))
  const month   = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))
  const history = parseInt(searchParams.get("history") ?? "0")

  // Try external API first
  try {
    const qs = searchParams.toString()
    const res = await fetch(`${API_BASE}/tax/vat${qs ? `?${qs}` : ""}`, {
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

  if (history > 0) {
    // Return array of last N months
    const months: Array<{ year: number; month: number }> = []
    for (let i = history - 1; i >= 0; i--) {
      const d = new Date(year, month - 1 - i)
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    }
    const results = await Promise.all(
      months.map(({ year: y, month: m }) => computeFromSupabase(supabase, orgId, y, m))
    )
    return NextResponse.json(results)
  }

  const data = await computeFromSupabase(supabase, orgId, year, month)
  return NextResponse.json(data)
}
