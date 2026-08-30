import Foundation
import MapKit

/// Works out the line to draw for each transport leg.
///
/// The web asks a routing server; iOS does not need to. MKDirections is on the
/// device, free, and knows the same road network Apple Maps uses — so a walking
/// leg gets the real footpath and a driving leg the real road, without a key, a
/// proxy or a third party seeing the trip.
///
/// WHAT GETS A REAL ROUTE
///   walk                      → MKDirections .walking
///   car_rental, taxi, bus     → MKDirections .automobile
///   flight, ferry             → a great circle: there is no road, and the curve
///                               is the shape the aircraft or vessel takes
///   train, shinkansen, subway → a great circle too. MKDirections has no rail
///                               profile, and a straight line between stations
///                               is what a transit diagram draws anyway
///
/// The result records WHICH kind it is, so the map can draw a real route solid
/// and a direct line dashed. A straight line presented as a route is worse than
/// one presented as a straight line — somebody will read a distance off it.
@MainActor
final class TripRouteStore: ObservableObject {

    struct Leg {
        let polyline: MKPolyline
        /// True when this is a real road/footpath, false when it is a direct line.
        let isRealRoute: Bool
        let distanceMetres: CLLocationDistance
        /// nil for direct lines — there is no travel time to claim.
        let expectedSeconds: TimeInterval?
    }

    @Published private(set) var legs: [String: Leg] = [:]

    /// Legs already asked for, so a re-render does not re-request.
    ///
    /// Keyed by item id AND endpoints: move a pin and the key changes, so that
    /// one leg is recomputed and the others are left alone. MKDirections is
    /// rate-limited per app, and a map that re-routes on every render burns
    /// through that budget in seconds.
    private var inFlight: Set<String> = []

    private static func key(_ id: String, _ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> String {
        String(format: "%@:%.4f,%.4f:%.4f,%.4f", id, a.latitude, a.longitude, b.latitude, b.longitude)
    }

    private static func transport(for type: String) -> MKDirectionsTransportType? {
        switch type {
        case "walk":                      return .walking
        case "car_rental", "taxi", "bus": return .automobile
        default:                          return nil   // no road network applies
        }
    }

    /// Computes anything missing. Safe to call on every render.
    func ensure(for items: [TripItineraryItem]) {
        for item in items {
            guard let start = item.coordinate,
                  let endLat = item.endLat, let endLng = item.endLng else { continue }

            let a = CLLocationCoordinate2D(latitude: start.lat, longitude: start.lng)
            let b = CLLocationCoordinate2D(latitude: endLat, longitude: endLng)
            let k = Self.key(item.id, a, b)
            if inFlight.contains(k) { continue }
            inFlight.insert(k)

            guard let mode = Self.transport(for: item.type) else {
                legs[item.id] = Self.directLeg(a, b)
                continue
            }
            Task { await route(itemId: item.id, from: a, to: b, mode: mode) }
        }
    }

    private func route(itemId: String, from a: CLLocationCoordinate2D,
                       to b: CLLocationCoordinate2D, mode: MKDirectionsTransportType) async {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: a))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: b))
        request.transportType = mode

        do {
            let response = try await MKDirections(request: request).calculate()
            guard let best = response.routes.first else {
                legs[itemId] = Self.directLeg(a, b); return
            }
            legs[itemId] = Leg(polyline: best.polyline, isRealRoute: true,
                               distanceMetres: best.distance,
                               expectedSeconds: best.expectedTravelTime)
        } catch {
            // No route exists (across water, or the mode cannot get there), or
            // the rate limit was hit. Either way the leg still needs a line, and
            // a direct one is honest — it is drawn dashed and says so.
            legs[itemId] = Self.directLeg(a, b)
        }
    }

    /// A great circle, which MapKit draws curved on a projected map.
    private static func directLeg(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Leg {
        var coords = [a, b]
        let line = MKGeodesicPolyline(coordinates: &coords, count: 2)
        let metres = MKMapPoint(a).distance(to: MKMapPoint(b))
        return Leg(polyline: line, isRealRoute: false, distanceMetres: metres, expectedSeconds: nil)
    }
}
