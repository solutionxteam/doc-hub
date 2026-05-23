import { createClient } from "@supabase/supabase-js"

/**
 * Admin Supabase client — uses service_role key, bypasses ALL RLS.
 * NEVER expose this client to the browser.
 * Only import in server-side code (API routes, server actions).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in environment. " +
      "Add it to .env.local from Supabase Dashboard → Settings → API."
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  })
}
