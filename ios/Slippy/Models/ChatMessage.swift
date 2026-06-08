import Foundation

/// Mirrors the `{ role, content }` message shape `/api/chat` expects/returns
/// (see `web/src/app/api/chat/route.ts`).
struct ChatMessage: Identifiable, Equatable, Codable {
    let id: UUID
    let role: Role
    let content: String

    enum Role: String, Codable { case user, assistant }

    init(id: UUID = UUID(), role: Role, content: String) {
        self.id = id
        self.role = role
        self.content = content
    }
}
