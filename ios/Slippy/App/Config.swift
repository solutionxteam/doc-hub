import Foundation

enum Config {
    // MARK: – Supabase
    static let supabaseURL  = URL(string: "https://ntzztcnkedcxfjvfxjrf.supabase.co")!
    static let supabaseAnon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50enp0Y25rZWRjeGZqdmZ4anJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzNTEwOTIsImV4cCI6MjA2NTkyNzA5Mn0.QSGtQhIlrzssH8wzpE25OT3ZanZJLa10tV-eETIOOrA"

    // MARK: – Web app (Next.js) — used for endpoints that must run server-side
    // (e.g. AI chat with Claude + Life Graph, Stripe checkout/portal) since
    // they need secrets that can't live in the client app.
    // Was incorrectly pointed at "app.slippy.app" (a domain that doesn't
    // exist in the web codebase) — the real canonical production domain,
    // per `web/src/app/layout.tsx` metadata, is slippy.ai.
    static let webAppURL    = URL(string: "https://slippy.ai")!

    // MARK: – App
    static let appName      = "Slippy"
    static let appVersion   = "1.0.0"
    static let demoOrgId    = "53d094c2-1d58-4f87-aee6-09aab0816692"
    static let storageBucket = "documents"
}
