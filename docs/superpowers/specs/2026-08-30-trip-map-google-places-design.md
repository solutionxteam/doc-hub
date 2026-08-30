# Trip Map — Search, Photos, Offline Cache, Category Pins — Design

**Status:** Approved by user 2026-08-30 (scope and four architectural decisions confirmed via clarifying questions — see Decisions Confirmed below). Ready for `writing-plans`.

## Problem

The user wants the trip map (iOS, `Slippy/Views/Trips/TripMapView.swift`) to work "like Google Maps": type a place name and get suggestions, tap to add it to the itinerary with a photo, and have that data available during travel without a signal. Today:

- There is no search bar. The only way to add a stop is to tap a point on the map; `TripMapView.swift` then reverse-geocodes it on-device via `CLGeocoder` and enriches it via one `MKLocalSearch` call (confirmed by reading `lookUpName()` and the POI-tap handler in that file).
- No photo is ever fetched or stored for a stop.
- Every screen requires a live connection — there is no local cache of anything.
- Pins render with iOS's default `MKPointOfInterestCategory`-driven styling; the user considers this "ugly" and wants colored category pins.

## Existing infrastructure discovered (reused, not rebuilt)

Before designing anything, the web app and database were checked for prior art, because building a second, parallel places system would be wasted work. Confirmed by reading each file directly:

| Piece | Where | What it already does |
|---|---|---|
| Google Maps API key | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` env var | Already configured and in live use server-side (see below) |
| `place_cache` table | `supabase/migrations/032_location_suggestions.sql` | One row per `google_place_id`: name, place_type, address, lat/lng, rating, `user_ratings_total`, `phone_number`, `website`, `opening_hours` (jsonb), `photo_url`, `price_level`, `cached_at`, `expires_at` (7-day TTL) |
| `/api/places` (GET) | `web/src/app/api/places/route.ts` | Google **Nearby Search** by category/radius; builds a ready-to-use `photo_url` from `photo_reference` + the key; upserts every Google result into `place_cache` |
| `/api/trips/geocode` (GET) | `web/src/app/api/trips/geocode/route.ts` | Name search **and** reverse-geocode via Nominatim/OpenStreetMap (free, no photos) — proxied server-side for CSP/User-Agent/rate-limit reasons documented in the file |
| `/api/trips/[id]/photos` (GET/POST) | `web/src/app/api/trips/[id]/photos/route.ts` | Manual photo upload, already complete: `trip_photos` table + public `trip-photos` Storage bucket, optionally tied to an itinerary item via `item_id` |
| `trip_itinerary_items.lat/lng/details` | `supabase/migrations/20260822120000_trip_journey_structure.sql` | `details jsonb DEFAULT '{}'` already holds ad-hoc fields (`TripMapView.swift`'s `save()` already writes `address`/`phone`/`website` into it via `AnyJSON`) — no migration needed to add `google_place_id`/`photo_url` |
| iOS → web auth pattern | `Slippy/Services/TripDocumentAPI.swift` | The precedent for "iOS needs something server-side": Bearer the user's Supabase access token, call `Config.webAppURL` (never embed a server secret in the app bundle) |

This means the only **missing** piece on the backend is name-based search with photos — `/api/places` is nearby-only, `/api/trips/geocode` has no photos. Everything else (cache table, key, photo upload, storage field) already exists and is reused as-is.

## Decisions Confirmed (with user, 2026-08-30)

1. **Offline scope:** cache place data + photos locally; the live map surface still needs internet. Apple's MapKit terms prohibit bulk tile pre-caching outside iOS's own short-lived cache — there is no public API for it, so "fully offline maps" would mean replacing MapKit with a different engine (e.g. MapLibre + OSM tiles), which is out of scope. (Considered and rejected: switching map engines — a much larger, unrelated change.)
2. **Photo source:** Google Places Photos as the primary, automatic source; manual upload (already-built `/api/trips/[id]/photos`) as a supplement the user can add to any stop. (Considered and rejected: Google-only — leaves the user with no photo when Google has none; manual-only — defeats the "automatic" ask.)
3. **Search engine:** Google Places (Text Search / Autocomplete), not Nominatim — richer results (ratings, hours, photos) and consistent with the photo source. (Considered and rejected: reusing `/api/trips/geocode` — free, but no photos, so the same place would need a second lookup anyway.)
4. **API call routing:** iOS → `api.slippyai.app` (the existing web app), which calls Google server-side — never a Google key embedded in the iOS bundle. Same posture as `/api/places` today and the same reasoning documented in `TripDocumentAPI.swift`. (Considered and rejected: calling Google directly from iOS — a bundled key is a published key, and it would bypass `place_cache` entirely.)
5. **Icon style:** colored circular pin + white SF Symbol per category + subtle shadow (Google Maps' own visual language), not emoji and not a fully custom illustrated set — no new asset pipeline needed, and it reads correctly in both light and dark mode using SF Symbols' built-in rendering.

## Design

### 1. New backend endpoint: `/api/places/search`

`web/src/app/api/places/search/route.ts`, modeled directly on `web/src/app/api/places/route.ts` (same auth-less-but-server-proxied posture, same `place_cache` upsert):

- `GET /api/places/search?q=<text>&lat=&lng=` — Google Places **Text Search** (the legacy `textsearch/json` endpoint, matching the Nearby Search endpoint already in use, rather than the newer Places API (New) — no reason to mix two Google Places API generations in one codebase). `lat`/`lng` bias results toward the trip's area, same as `/api/places` today.
- Returns the same result shape as `/api/places` (`id, name, type, address, lat, lng, rating, photo_url, ...`) so the iOS client and any future web UI share one model.
- Every result is upserted into `place_cache`, exactly like `/api/places` does — this single table now backs nearby search, text search, and the offline cache read path.
- **Setup dependency, not code:** this assumes the "Places API" (legacy) is enabled for the GCP project behind the existing key — it already must be, since `/api/places` uses `nearbysearch` from the same family. Text Search is enabled/disabled together with Nearby Search on that same legacy API, so no separate enablement step is expected. If it turns out to be disabled, Google returns a clean `REQUEST_DENIED` status in the JSON body (not an HTTP error), which the route surfaces as `{ error, results: [] }` rather than crashing — the failure mode is visible and cheap to diagnose, not silent.

### 2. iOS: `PlacesSearchAPI.swift`

New file, `Slippy/Services/PlacesSearchAPI.swift`, following `TripDocumentAPI.swift`'s exact pattern (Bearer token, `Config.webAppURL`, the same `APIError` enum shape):

- `search(query:, near: CLLocationCoordinate2D?) async throws -> [PlaceResult]` → calls `/api/places/search`
- `uploadPhoto(tripId:, itemId:, image: UIImage) async throws -> TripPhoto` → calls the existing `/api/trips/[id]/photos` (multipart form, same as the web route expects)
- `PlaceResult` mirrors the JSON shape from step 1: id (google\_place\_id), name, address, lat, lng, category (mapped through the existing `appType(for:)`-style logic, extended to read Google's `type` string instead of `MKPointOfInterestCategory`), photoURL, rating.

### 3. `TripMapView.swift`: search bar + updated save flow

- A search field pinned above the map (SwiftUI `.searchable` or an inline `TextField`, debounced ~300ms per keystroke) calls `PlacesSearchAPI.search`.
- Results list shows name, address, category icon (see §4), thumbnail if `photoURL` is present.
- Tapping a result reuses the existing `AddStopSheet` (already built — title/type/address/phone/website/coordinate fields), now pre-filled from the `PlaceResult`, plus a hidden `google_place_id` carried through to save.
- `save()` (currently writes `address`/`phone`/`website` into `details` via `AnyJSON`) gains two more keys when a search result was selected: `details["google_place_id"]` and `details["photo_url"]`. Tap-on-empty-map (the existing on-device reverse-geocode flow) is unchanged — it still has no Google data to attach, and that's fine; not every stop needs a photo.
- The existing manual-tap-a-POI flow (`appType(for: MKPointOfInterestCategory)`) is untouched — this is additive, not a replacement of the working tap gesture.
- A "add photo" button in the stop detail view calls `PlacesSearchAPI.uploadPhoto` (the manual-supplement path from Decision 2).

### 4. `CategoryPin.swift` — new SwiftUI view

Replaces the current annotation content in `TripMapView.swift`. A filled `Circle()` (36pt) in a per-category color, a white SF Symbol centered inside, `.shadow(radius: 3, y: 2)`. Category → (color, symbol) table, extending the existing five `appType()` cases:

| Category | Color | SF Symbol |
|---|---|---|
| restaurant | `.red` | `fork.knife` |
| hotel | `.blue` | `bed.double.fill` |
| shopping | `.purple` | `bag.fill` |
| activity | `.green` | `figure.walk` |
| onsen | `.teal` | `drop.fill` |

This is a pure view-layer change — no data model impact, so it's safe to build and verify independently of §1–3.

### 5. Offline cache

New file, `Slippy/Services/TripOfflineCache.swift`:

- **What's cached:** for every itinerary item that has a `google_place_id` or a `photo_url` in `details`, the place's text fields (already in `details`, nothing new to fetch) plus the photo image bytes, downloaded once and written to `FileManager.default.urls(for: .cachesDirectory, ...)/trip-photos/<itemId>.jpg`. Text fields are trivial (already local, in the Supabase-synced `TripItineraryItem` model / its local cache); only the photo bytes need an explicit download step.
- **When it's cached:** opportunistically, the moment a trip's itinerary is fetched while online (piggybacks on the existing `TripsViewModel` fetch — no separate "download for offline" button, matching the "just works" framing from the original ask). A photo already on disk is not re-downloaded.
- **Offline read path:** the itinerary list (`TripDetailView`'s plan tab) reads photos from the local file if present, network otherwise — this already degrades gracefully today for any `AsyncImage`-style loader; the change is adding the local-file check *before* the network attempt.
- **Offline map surface:** `TripMapView.swift` checks reachability via a new `NetworkStatus.swift` (`NWPathMonitor`-based; confirmed by search that nothing like this exists yet — `PhoneConnectivityManager.swift` is `WatchConnectivity` for the paired Watch, a different concern entirely). When offline, the map area itself renders a placeholder card — "ต้องต่ออินเทอร์เน็ตเพื่อดูแผนที่" (connect to the internet to see the map) — instead of a blank/frozen MapKit view, while the day's stop list (name, address, cached photo) below or beside it stays fully usable, per Decision 1.
- **No new Supabase table.** This is a device-local cache only; it never needs to sync or be shared, so it doesn't belong in Postgres.

## Data flow (search → add → offline)

```
Online:
  User types → PlacesSearchAPI.search → /api/places/search → Google Text Search
    → place_cache upsert → PlaceResult[] → AddStopSheet (prefilled)
    → save() → trip_itinerary_items.details += {google_place_id, photo_url}
    → (next itinerary fetch, opportunistically) TripOfflineCache downloads the photo

Offline:
  TripDetailView plan tab → reads details.* (already local) + cached photo file
  TripMapView → reachability check fails → placeholder card, stop list still shown
```

## Error handling

- Google quota/billing failure at `/api/places/search` → `REQUEST_DENIED`/`OVER_QUERY_LIMIT` from Google is caught the same way `/api/places` already catches it (try/catch around the `fetch`, logged, `{ error, results: [] }` returned) — search box shows "ค้นหาไม่สำเร็จ ลองอีกครั้ง" rather than crashing.
- Photo download failure (offline cache step) is silent/best-effort, exactly like the existing `MKLocalSearch` enrichment in `TripMapView.swift` ("failure is fine — the user can type the name") — a missing cached photo just means that stop's offline card shows no image, not an error state.
- `PlacesSearchAPI` reuses `TripDocumentAPI.APIError` (`.notSignedIn`, `.server`, `.badResponse`) rather than inventing a parallel error type.

## Testing plan

Given the explicit "test it so it actually works, no back-and-forth" ask, verification happens at three levels before this is considered done, matching how the medication-scan and trip-map fixes were verified earlier this session:

1. **Backend:** `curl` the new `/api/places/search` endpoint directly (as done earlier this session for `/api/medications/scan`) with a real query, confirm a 200 with real Google results and a working `photo_url`, confirm `place_cache` gets the upsert.
2. **Build:** `xcodebuild` for the `Slippy` scheme must succeed with 0 errors after each new file — same discipline as the two build fixes earlier this session.
3. **Simulator, end-to-end:** launch the built app, open a trip's map, use the search bar for a real query, add a result as a stop, confirm the colored category pin renders, confirm the photo appears. Then toggle the simulator's network off (`Network Link Conditioner` or airplane mode in the simulator) and confirm: the stop list still shows cached text + photo, and the map area shows the offline placeholder instead of crashing or hanging.

## Open items / setup dependencies

- None blocking. The Google key, billing, and Places API enablement already exist and are already load-bearing for `/api/places` in production — this reuses the same project, not a new one.
