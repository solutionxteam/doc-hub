import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Resolve a LINE userId → { organization_id, user_id } via line_connections.
async function resolveConnection(admin: ReturnType<typeof createAdminClient>, lineUserId: string) {
  const { data } = await admin.from("line_connections")
    .select("user_id, organization_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle()
  return data
}

// GET /api/liff/sport-groups/venues?lineUserId=Uxxx — "สนามที่เคยใช้": distinct
// venues from this user's past sport groups, most-recent first.
export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")
  if (!lineUserId) return NextResponse.json({ error: "lineUserId required" }, { status: 400 })

  const admin = createAdminClient()
  const conn  = await resolveConnection(admin, lineUserId)
  if (!conn) return NextResponse.json({ venues: [] })

  const { data: parts } = await admin.from("split_participants")
    .select("split_bill_id").eq("line_user_id", lineUserId)

  const billIds = [...new Set((parts ?? []).map(p => p.split_bill_id))]
  if (billIds.length === 0) return NextResponse.json({ venues: [] })

  const { data: bills } = await admin.from("split_bills")
    .select("venue, court_no, map_url, created_at")
    .in("id", billIds)
    .eq("category", "sport")
    .not("venue", "is", null)
    .order("created_at", { ascending: false })

  const seen = new Set<string>()
  const venues: { venue: string; courtNo: string | null; mapUrl: string | null }[] = []
  for (const b of bills ?? []) {
    const key = b.venue as string
    if (!key || seen.has(key)) continue
    seen.add(key)
    venues.push({ venue: key, courtNo: b.court_no ?? null, mapUrl: b.map_url ?? null })
    if (venues.length >= 5) break
  }

  return NextResponse.json({ venues })
}
