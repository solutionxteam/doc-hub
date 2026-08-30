/**
 * Who is allowed to act on a trip.
 *
 * Every trip route reaches for the admin (service-role) client, which bypasses
 * RLS entirely — so `auth.getUser()` returning a user proves only that somebody
 * is logged in, never that they have anything to do with THIS trip. Without an
 * explicit check a trip id is effectively a bearer token: anyone with an account
 * can read or write any trip whose id they can guess or see.
 *
 * §2 of the handoff makes membership checks non-negotiable for production
 * writes, so authorization lives in one place rather than being re-derived (or
 * forgotten) per route.
 */

/**
 * The slice of the Supabase client these helpers use.
 *
 * Injectable so the authorization rules can be tested without a database or the
 * service-role key. The default is resolved lazily inside each function rather
 * than imported at module scope, which keeps the `@/` path alias out of the
 * test runner's resolver (`node --experimental-strip-types` cannot follow it).
 */
export interface TripDb { from: (table: string) => any }

async function defaultDb(): Promise<TripDb> {
  const { createAdminClient } = await import("@/lib/supabase/admin")
  return createAdminClient() as unknown as TripDb
}

export type TripRole = "owner" | "participant" | "none"

export interface TripAccess {
  role:      TripRole
  allowed:   boolean
  journeyId: string
  orgId:     string | null
}

/**
 * Resolves a user's relationship to a trip.
 *
 * Org membership alone is deliberately NOT enough to be a `participant`: the
 * owning org can be large, and a trip is a personal, social record. Org
 * membership is reported separately via `orgId` for callers that legitimately
 * need it (accounting rollups), but it does not grant a seat in the trip.
 */
export async function getTripAccess(
  journeyId: string,
  userId: string,
  db?: TripDb,
): Promise<TripAccess> {
  const admin = db ?? await defaultDb()

  const { data: journey } = await admin
    .from("life_journeys")
    .select("id, user_id, organization_id")
    .eq("id", journeyId)
    .maybeSingle()

  if (!journey) return { role: "none", allowed: false, journeyId, orgId: null }

  if (journey.user_id === userId) {
    return { role: "owner", allowed: true, journeyId, orgId: journey.organization_id }
  }

  const { data: participant } = await admin
    .from("trip_participants")
    .select("id")
    .eq("journey_id", journeyId)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle()

  if (participant) {
    return { role: "participant", allowed: true, journeyId, orgId: journey.organization_id }
  }

  return { role: "none", allowed: false, journeyId, orgId: journey.organization_id }
}

/**
 * True when the user may invite others or change trip-wide settings.
 * Participants can talk and spend; reshaping the guest list is the owner's.
 */
export async function canManageTrip(
  journeyId: string,
  userId: string,
  db?: TripDb,
): Promise<boolean> {
  const access = await getTripAccess(journeyId, userId, db)
  return access.role === "owner"
}
