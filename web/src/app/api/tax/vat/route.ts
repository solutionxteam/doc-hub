import { NextRequest, NextResponse } from "next/server"
import { createClient }        from "@/lib/supabase/server"

const API_BASE     = process.env.API_BASE_URL    ?? "http://localhost:4000"
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

/** GET /api/tax/vat?orgId=...&year=2024&month=1 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const qs = searchParams.toString()

  try {
    const res = await fetch(`${API_BASE}/tax/vat${qs ? `?${qs}` : ""}`, {
      headers: {
        "x-internal-key": INTERNAL_KEY,
        "x-user-id":      user.id,
      },
    })

    const text = await res.text()
    if (!text) return NextResponse.json({ error: "Empty response from backend" }, { status: 502 })

    const data = JSON.parse(text)
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    console.error("[/api/tax/vat] Backend unreachable:", err.message)
    // Return empty VAT summary so the UI degrades gracefully
    return NextResponse.json({
      input:   { vat: 0, base: 0 },
      output:  { vat: 0, base: 0 },
      net_vat: 0,
      due_date: null,
    })
  }
}
