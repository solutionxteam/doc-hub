import { createClient }   from "@/lib/supabase/server"
import { getBearerToken } from "@/lib/liff-auth"
import type { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"

/**
 * Resolves the caller, whether they are a browser or the iOS app.
 *
 * `createClient()` reads cookies only. The iOS app has no cookie jar — it sends
 * a Supabase access token in `Authorization: Bearer …`. A route that calls
 * `auth.getUser()` and stops there therefore works perfectly in a browser and
 * rejects every request from the phone, which is the single most likely way to
 * break the app while adding an authorization check. Middleware already handles
 * both; route handlers need the same, and needed it in one place rather than
 * re-derived per route.
 *
 * Returns null when neither credential resolves — callers decide the status
 * code, since "not signed in" and "signed in but not yours" deserve different
 * answers.
 */
export async function getAuthedUser(req?: NextRequest): Promise<User | null> {
  const sb = await createClient()

  const { data: { user: cookieUser } } = await sb.auth.getUser()
  if (cookieUser) return cookieUser

  if (!req) return null
  const bearer = getBearerToken(req)
  if (!bearer) return null

  // Verified against Supabase, not merely decoded — a token that only *looks*
  // like a JWT proves nothing.
  const { data: { user: bearerUser } } = await sb.auth.getUser(bearer)
  return bearerUser ?? null
}
