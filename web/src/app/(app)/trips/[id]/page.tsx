import { getMembership }   from "@/lib/get-membership"
import { createClient }    from "@/lib/supabase/server"
import { notFound }        from "next/navigation"
import { TripDetailClient } from "@/components/trips/trip-detail-client"

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  const { data: trip } = await supabase.from("life_journeys")
    .select(`
      id, title, trip_type, sport_type, destination, venue,
      event_date, started_at, ended_at, status, split_mode,
      share_token, base_fee, cover_emoji, notes, created_at,
      trip_participants(id, display_name, is_host, amount_owed, amount_paid, paid_at,
                        line_user_id, promptpay_type, promptpay_value, qr_image_url)
    `)
    .eq("id", id).eq("organization_id", orgId).single()

  if (!trip) notFound()

  const { data: expenses } = await supabase.from("trip_expenses")
    .select(`
      id, title, amount, category, split_mode, note, expense_date,
      paid_by_id,
      trip_participants!trip_expenses_paid_by_id_fkey(id, display_name),
      expense_splits(participant_id, amount, is_paid)
    `)
    .eq("journey_id", id).order("expense_date")

  const { data: payments } = await supabase.from("trip_payments")
    .select("id, from_participant, to_participant, amount, slip_url, status, paid_at, note")
    .eq("journey_id", id).order("paid_at", { ascending: false })

  // Settlement calculation
  let settlement: any[] = []
  try {
    const { data: s } = await supabase
      .rpc("calculate_trip_settlement", { p_journey_id: id })
    settlement = s ?? []
  } catch { /* settlement not available */ }

  return (
    <TripDetailClient
      trip={trip as any}
      expenses={(expenses ?? []) as any}
      payments={(payments ?? []) as any}
      settlement={(settlement ?? []) as any}
      orgId={orgId}
    />
  )
}
