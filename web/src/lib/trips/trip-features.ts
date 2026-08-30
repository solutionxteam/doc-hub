/**
 * Feature gates for the Trip Full Loop phases that are not shippable yet.
 *
 * The handoff is explicit that maps, live location and calling stay behind
 * disabled flags until their credentials, schema and privacy configuration are
 * ready (§13.6), and each is blocked on something a flag cannot supply:
 *
 *   maps     — no restricted Google keys, and web CSP/Permissions-Policy do not
 *              yet allow Maps hosts (§5, §7).
 *   location — no `trip_location_sessions` / `trip_member_locations` schema, no
 *              retention job, and `geolocation=()` is still denied (§5, §8).
 *   calls    — no VoIP provider chosen, no token endpoint, no CallKit/PushKit
 *              flow (§5, §6.5).
 *
 * A flag reads as enabled only when its env var is exactly "1". Anything else —
 * unset, "true", "yes", empty — is off, so a half-configured environment cannot
 * quietly switch on a feature whose consent UI does not exist. Location in
 * particular must never turn on by accident: §2 forbids silent tracking, and the
 * safe default has to survive a typo in a deploy script.
 */

function enabled(name: string): boolean {
  return process.env[name] === "1"
}

export const tripFeatures = {
  /** Real Google Maps rendering and place search. */
  get maps(): boolean { return enabled("TRIP_FEATURE_MAPS") },

  /**
   * Temporary, opt-in, trip-scoped live location.
   * Requires the Phase 3 schema and retention policy before it can be honoured.
   */
  get liveLocation(): boolean { return enabled("TRIP_FEATURE_LIVE_LOCATION") },

  /** Voice/video calling via a server-issued, membership-checked room token. */
  get calls(): boolean { return enabled("TRIP_FEATURE_CALLS") },
} as const

/**
 * Guard for API routes belonging to a gated phase. Returns a 404-shaped result
 * rather than 403: an unshipped feature should be indistinguishable from one
 * that does not exist, so a probe cannot enumerate what is coming.
 */
export function featureDisabledResponse(feature: keyof typeof tripFeatures) {
  return {
    body:   { error: "Not found" },
    status: 404 as const,
    reason: `trip feature "${feature}" is disabled`,
  }
}
