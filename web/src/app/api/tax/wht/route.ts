import { NextRequest, NextResponse } from "next/server"
import { createClient }        from "@/lib/supabase/server"

const API_BASE     = process.env.API_BASE_URL    ?? "http://localhost:4000"
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

/** GET /api/tax/wht?orgId=...&year=2024&month=1 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const qs = searchParams.toString()

  try {
    const res = await fetch(`${API_BASE}/tax/wht${qs ? `?${qs}` : ""}`, {
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
    console.error("[/api/tax/wht] Backend unreachable:", err.message)
    // Return empty WHT summary so the UI degrades gracefully
    return NextResponse.json({
      items:       [],
      total_base:  0,
      total_wht:   0,
    })
  }
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
