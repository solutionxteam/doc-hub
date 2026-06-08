import { getMembership } from "@/lib/get-membership"
import { createClient }  from "@/lib/supabase/server"
import { TripsClient }   from "@/components/trips/trips-client"

export default async function TripsPage() {
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  const { data: trips } = await supabase
    .from("life_journeys")
    .select(`
      id, title, trip_type, sport_type, destination, venue,
      event_date, started_at, ended_at, status, split_mode,
      share_token, base_fee, cover_emoji, notes, created_at,
      trip_participants(id, display_name, amount_owed, amount_paid, is_host, qr_image_url)
    `)
    .eq("organization_id", orgId)
    .not("trip_type", "is", null)
    .order("created_at", { ascending: false })

  return <TripsClient orgId={orgId} trips={(trips ?? []) as any} />
}
