import Foundation
import UIKit

/// Handing a stop or a leg off to Google Maps — the iOS twin of
/// web/src/lib/trips/google-maps-links.ts.
///
/// No API key, no SDK: the universal `https://www.google.com/maps/...` link
/// (developers.google.com/maps/documentation/urls) is what this uses — Google's
/// own iOS docs recommend it over the app-specific `comgooglemaps://` scheme
/// for exactly this case ("cross-platform Maps URLs" over the iOS scheme).
/// iOS hands the universal link to the Google Maps app itself when it is
/// installed, via the same universal-links mechanism as any other deep link,
/// and opens it in Safari otherwise — no scheme detection needed on this end.
///
/// A `comgooglemaps://` version was tried first and DELETED before shipping:
/// its documented parameters are `saddr`/`daddr`/`directionsmode`, not the web
/// scheme's `origin`/`destination`/`travelmode` — the same query string handed
/// to that scheme would have opened the app with parameters it does not
/// recognise, silently, no error, no route. Verified against Google's current
/// iOS URL scheme docs rather than assumed.
///
/// The waypoint cap (3) is Google's own documented mobile-browser limit for the
/// universal directions link, confirmed against their current docs. Exceeding
/// it does not error either — it silently drops the extra stops.
enum GoogleMapsLinks {

    typealias Coordinate = (lat: Double, lng: Double)

    enum TravelMode: String { case driving, walking, transit, bicycling }

    /// Which Google travel mode applies to an itinerary type, or nil when there
    /// is none — a flight or a ferry has no road/rail equivalent, and forcing
    /// "driving" onto one would offer to drive across the sea.
    static func travelMode(for type: String) -> TravelMode? {
        switch type {
        case "walk": return .walking
        case "car_rental", "taxi", "bus": return .driving
        case "train", "shinkansen", "subway": return .transit
        default: return nil
        }
    }

    private static func coord(_ c: Coordinate) -> String { "\(c.lat),\(c.lng)" }

    /// A single pin — works for anything with coordinates.
    static func pinURL(_ point: Coordinate, label: String? = nil) -> URL {
        let q = label.map { "\($0) @\(coord(point))" } ?? coord(point)
        var comps = URLComponents(string: "https://www.google.com/maps/search/")!
        comps.queryItems = [.init(name: "api", value: "1"), .init(name: "query", value: q)]
        return comps.url!
    }

    /// Opens Google Street View at a point. No API key — same universal
    /// scheme as the rest of this file, confirmed against Google's current
    /// Maps URLs docs (fetched 2026-08-25): `map_action=pano` + `viewpoint`
    /// opens the panorama photographed closest to that coordinate.
    static func streetViewURL(_ point: Coordinate) -> URL {
        var comps = URLComponents(string: "https://www.google.com/maps/@")!
        comps.queryItems = [
            .init(name: "api", value: "1"),
            .init(name: "map_action", value: "pano"),
            .init(name: "viewpoint", value: coord(point)),
        ]
        return comps.url!
    }

    /// Directions with up to 3 waypoints. `origin` omitted lets Google Maps use
    /// the device's current location — the realistic case while travelling.
    static func directionsURL(
        origin: Coordinate? = nil,
        destination: Coordinate,
        waypoints: [Coordinate] = [],
        mode: TravelMode? = nil
    ) -> URL {
        var items = [URLQueryItem(name: "api", value: "1"),
                     URLQueryItem(name: "destination", value: coord(destination))]
        if let origin { items.append(.init(name: "origin", value: coord(origin))) }
        if let mode { items.append(.init(name: "travelmode", value: mode.rawValue)) }
        let kept = Array(waypoints.prefix(3))
        if !kept.isEmpty {
            items.append(.init(name: "waypoints", value: kept.map(coord).joined(separator: "|")))
        }
        var comps = URLComponents(string: "https://www.google.com/maps/dir/")!
        comps.queryItems = items
        return comps.url!
    }

    /// Opens a Google Maps URL. iOS routes a universal link like this one to
    /// the Google Maps app when it is installed; Safari handles it otherwise.
    /// Nothing else to decide here — see the type header for why.
    @MainActor
    static func open(_ url: URL) {
        UIApplication.shared.open(url)
    }
}
