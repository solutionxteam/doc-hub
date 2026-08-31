import Foundation
import CoreLocation

/// Foreground-only live location for one trip screen. No
/// NSLocationAlwaysAndWhenInUseUsageDescription is requested — sharing stops
/// the moment the app backgrounds, per the spec's locked-in decision.
@MainActor
final class TripLocationViewModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var mySession: TripLocationAPI.Session?
    @Published var others: [TripLocationAPI.MemberLocation] = []
    @Published var permissionDenied = false
    @Published var errorText: String?

    private let manager = CLLocationManager()
    private var journeyId: String?
    private var pingTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func startSharing(journeyId: String, duration: TripLocationAPI.Duration) {
        self.journeyId = journeyId
        Task {
            do {
                let session = try await TripLocationAPI.start(journeyId: journeyId, duration: duration)
                mySession = session
                manager.requestWhenInUseAuthorization()
                manager.startUpdatingLocation()
                startPingLoop(sessionId: session.id, journeyId: journeyId)
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    func stopSharing() {
        guard let session = mySession else { return }
        pingTask?.cancel()
        manager.stopUpdatingLocation()
        Task {
            try? await TripLocationAPI.stop(sessionId: session.id)
            mySession = nil
        }
    }

    /// Posts the current location every 12 seconds while a session is
    /// active — inside the spec's 10-15s cadence, matched to how often other
    /// members' pins should visibly move.
    private func startPingLoop(sessionId: String, journeyId: String) {
        pingTask?.cancel()
        pingTask = Task { [weak self] in
            while let self, !Task.isCancelled, self.mySession != nil {
                if let loc = self.manager.location {
                    try? await TripLocationAPI.ping(
                        sessionId: sessionId, journeyId: journeyId, coordinate: loc.coordinate,
                        accuracy: loc.horizontalAccuracy, heading: loc.course >= 0 ? loc.course : nil,
                        speed: loc.speed >= 0 ? loc.speed : nil
                    )
                }
                try? await Task.sleep(nanoseconds: 12_000_000_000)
            }
        }
    }

    /// Other members' pins — polled, not subscribed, matching this app's
    /// existing convention (MessagesViewModel has no realtime subscription
    /// either; "refresh on open + pull-to-refresh" is the established
    /// pattern here, extended to a repeating timer since a live map needs to
    /// visibly move without the user manually refreshing).
    func startPolling(journeyId: String) {
        self.journeyId = journeyId
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                if let locations = try? await TripLocationAPI.activeLocations(journeyId: journeyId) {
                    self.others = locations
                }
                try? await Task.sleep(nanoseconds: 10_000_000_000)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            switch manager.authorizationStatus {
            case .denied, .restricted: self.permissionDenied = true
            default: self.permissionDenied = false
            }
        }
    }
}
