import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/life/graph — Life Graph overview for an org
// Returns: top merchants, recent events, memory summary, life score
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId  = req.nextUrl.searchParams.get("orgId")
  const period = req.nextUrl.searchParams.get("period") ?? "30"  // days
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  const since = new Date(Date.now() - Number(period) * 86400000).toISOString()
  const now   = new Date().toISOString()

  // Parallel queries
  const [
    merchantsRes, eventsRes, insightsRes, memoriesRes, journeysRes, scoreRes
  ] = await Promise.all([
    // Top merchants by spend
    supabase.from("life_merchants")
      .select("id, name, category, visit_count, total_spent, avg_amount, last_visit_at")
      .eq("organization_id", orgId)
      .order("total_spent", { ascending: false })
      .limit(10),

    // Recent events (last N days)
    supabase.from("life_events")
      .select(`
        id, event_type, amount, category, doc_category, description, occurred_at,
        life_merchants(name, category)
      `)
      .eq("organization_id", orgId)
      .eq("event_type", "expense")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(50),

    // Unread insights
    supabase.from("life_insights")
      .select("id, insight_type, title, body, data, priority, created_at")
      .eq("organization_id", orgId)
      .eq("is_read", false)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),

    // AI Memory snapshot
    supabase.from("life_memories")
      .select("memory_type, key, value, observation_count")
      .eq("organization_id", orgId)
      .order("observation_count", { ascending: false })
      .limit(20),

    // Recent journeys
    supabase.from("life_journeys")
      .select("id, title, journey_type, started_at, ended_at, destination, cover_emoji")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(5),

    // Life score from documents (computed)
    supabase.from("documents")
      .select("status, overall_confidence, doc_category", { count: "exact" })
      .eq("organization_id", orgId)
      .limit(1000),
  ])

  // Compute spending summary
  const events      = eventsRes.data ?? []
  const totalSpent  = events.reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const byCat: Record<string, number> = {}
  for (const e of events) {
    const c = e.doc_category ?? "other"
    byCat[c] = (byCat[c] ?? 0) + Number(e.amount ?? 0)
  }

  // Compute life score (simple heuristic before migration)
  const docs         = scoreRes.data ?? []
  const approvedDocs = docs.filter(d => ["approved", "pushed"].includes(d.status)).length
  const approvalRate = docs.length > 0 ? approvedDocs / docs.length : 0
  const wealthScore  = Math.round(approvalRate * 70 + Math.min(docs.length, 30))
  const journeyScore = Math.min((journeysRes.data?.length ?? 0) * 20, 100)
  const lifeScore    = Math.round(wealthScore * 0.6 + journeyScore * 0.4)

  return NextResponse.json({
    merchants:  merchantsRes.data ?? [],
    events:     events.slice(0, 20),
    insights:   insightsRes.data ?? [],
    memories:   memoriesRes.data ?? [],
    journeys:   journeysRes.data ?? [],
    summary: {
      total_spent:   totalSpent,
      event_count:   events.length,
      by_category:   byCat,
      period_days:   Number(period),
    },
    life_score: {
      overall:  lifeScore,
      wealth:   wealthScore,
      journey:  journeyScore,
      doc_count: docs.length,
    },
  })
}
