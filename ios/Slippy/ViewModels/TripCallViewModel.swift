// ios/Slippy/ViewModels/TripCallViewModel.swift
import Foundation
import LiveKit

/// Voice-only for this plan — never requests or publishes a camera track.
@MainActor
final class TripCallViewModel: ObservableObject {
    @Published var connected = false
    @Published var connecting = false
    @Published var errorText: String?

    private var room: Room?

    func join(tripId: String) async {
        connecting = true
        defer { connecting = false }
        do {
            let callToken = try await TripCallAPI.requestToken(tripId: tripId)
            let room = Room()
            try await room.connect(url: callToken.url, token: callToken.token)
            try await room.localParticipant.setMicrophone(enabled: true)
            self.room = room
            connected = true
        } catch {
            errorText = error.localizedDescription
        }
    }

    func leave() async {
        await room?.disconnect()
        room = nil
        connected = false
    }
}
