import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/life/populate
 * Trigger Life Graph population for a manually approved document.
 * Called from review-client when user approves via web (not auto-approve).
 *
 * The actual population runs via the API server (port 4000) which has
 * direct access to the life-graph service. We forward the request there.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { documentId } = await req.json()
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 })

  // Forward to API server for Life Graph population
  try {
    const apiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:4000"
    await fetch(`${apiUrl}/life/populate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY ?? "" },
      body:    JSON.stringify({ documentId }),
    })
  } catch {
    // Non-blocking — Life Graph population failure doesn't affect the user experience
  }

  return NextResponse.json({ ok: true })
}
