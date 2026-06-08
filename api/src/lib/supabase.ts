import { createClient as _createClient } from "@supabase/supabase-js"
import "dotenv/config"
// NOTE: `import "dotenv/config"` loads .env WITHOUT override.
// In run-workers.ts we use dynamic imports (await import(...)) AFTER calling
// `config({ override: true })`, so by the time this file is evaluated, the
// correct env vars are already set and dotenv/config will not overwrite them.

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error(
    `[supabase] Missing env vars.\n` +
    `  SUPABASE_URL         = ${process.env.SUPABASE_URL         ? "✓" : "❌ MISSING"}\n` +
    `  SUPABASE_SERVICE_KEY = ${process.env.SUPABASE_SERVICE_KEY ? "✓" : "❌ MISSING"}\n` +
    `  If running via workers, ensure dotenv config({ override:true }) runs before any imports.`
  )
}

/** Singleton service-role Supabase client for all server-side pipeline code */
export const supabase = _createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Factory alias — returns the singleton above.
 * Allows callers to write `const supabase = createClient()` for consistency.
 */
export function createClient() {
  return supabase
}
