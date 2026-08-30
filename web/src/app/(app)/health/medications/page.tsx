import { createClient }     from "@/lib/supabase/server"
import { MedicationsClient } from "@/components/health/medications-client"

export default async function MedicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [medsRes, logsRes] = await Promise.all([
    supabase.from("medications")
      .select(`
        id, name, brand_name, dosage_form, strength, category, purpose,
        is_chronic, color, notes, image_url,
        medication_schedules(id, times, dose_qty, meal_relation, meal_note, reminder_enabled, is_active),
        medication_inventory(qty_remaining, qty_unit, low_stock_alert, expiry_date)
      `)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name"),

    supabase.from("medication_logs")
      .select("id, medication_id, scheduled_at, taken_at, status, dose_taken")
      .eq("user_id", user.id)
      .gte("scheduled_at", new Date().toISOString().slice(0, 10) + "T00:00:00+07:00")
      .order("scheduled_at"),
  ])

  // Adherence stats (last 30 days)
  const { data: adherence } = await supabase
    .from("medication_adherence")
    .select("medication_id, adherence_pct, taken, total_doses")
    .eq("user_id", user.id)

  return (
    <MedicationsClient
      medications={(medsRes.data ?? []) as any}
      todayLogs={(logsRes.data ?? []) as any}
      adherenceStats={(adherence ?? []) as any}
      userId={user.id}
    />
  )
}
