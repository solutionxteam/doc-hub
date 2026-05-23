import { NextRequest, NextResponse } from "next/server"
import { createClient }        from "@/lib/supabase/server"

const API_BASE     = process.env.API_BASE_URL    ?? "http://localhost:4000"
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

/** POST /api/integrations — save an integration API key */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const res = await fetch(`${API_BASE}/integrations`, {
    method:  "POST",
    headers: {
      "Content-Type":   "application/json",
      "x-internal-key": INTERNAL_KEY,
      "x-user-id":      user.id,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

/** GET /api/integrations — list integrations for current user's org */
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const res = await fetch(`${API_BASE}/integrations`, {
    headers: {
      "x-internal-key": INTERNAL_KEY,
      "x-user-id":      user.id,
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
