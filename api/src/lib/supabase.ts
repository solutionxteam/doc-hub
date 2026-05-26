import { createClient as _createClient } from "@supabase/supabase-js"
import "dotenv/config"

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
}

/** Singleton service-role Supabase client for all server-side pipeline code */
export const supabase = _createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
)

/**
 * Factory alias — returns the singleton above.
 * Allows callers to write `const supabase = createClient()` for consistency
 * with other parts of the codebase.
 */
export function createClient() {
  return supabase
}
