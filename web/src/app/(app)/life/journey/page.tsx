import { getMembership } from "@/lib/get-membership"
import { createClient }  from "@/lib/supabase/server"
import { JourneyListClient } from "@/components/life/journey-list-client"

export default async function JourneyPage() {
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  const { data: journeys } = await supabase
    .from("life_journeys")
    .select("id, title, description, journey_type, cover_emoji, started_at, ended_at, destination, created_at")
    .eq("organization_id", orgId)
    .order("started_at", { ascending: false })

  // Enrich with expense counts from life_events
  const ids = (journeys ?? []).map(j => j.id)
  let counts: Record<string, { count: number; total: number }> = {}
  if (ids.length > 0) {
    const { data: events } = await supabase
      .from("life_events")
      .select("journey_id, amount")
      .in("journey_id", ids)
      .eq("event_type", "expense")
    for (const e of events ?? []) {
      if (!e.journey_id) continue
      if (!counts[e.journey_id]) counts[e.journey_id] = { count: 0, total: 0 }
      counts[e.journey_id].count++
      counts[e.journey_id].total += Number(e.amount ?? 0)
    }
  }

  const enriched = (journeys ?? []).map(j => ({ ...j, ...counts[j.id] }))

  return <JourneyListClient orgId={orgId} journeys={enriched} />
}
