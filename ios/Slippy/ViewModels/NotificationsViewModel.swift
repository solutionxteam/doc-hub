import SwiftUI
import Supabase

/// Mirrors the read/write logic of `web/src/app/api/notifications/route.ts`
/// directly against Supabase (the mobile client talks to Supabase straight,
/// without the Next.js API layer) so both platforms stay on one source of
/// truth: same table, same filter (`user_id` OR `organization_id`), same
/// ordering, same "mark as read" semantics.
@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published var items: [AppNotification] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var marking = false

    private let db = SupabaseManager.shared.client

    var unreadCount: Int { items.filter(\.isUnread).count }

    func load(userId: String, orgId: String?, limit: Int = 50) async {
        isLoading = true
        error = nil
        do {
            // Same `.or(user_id.eq.X,organization_id.eq.Y)` filter as the web route
            let filter = orgId.map { "user_id.eq.\(userId),organization_id.eq.\($0)" }
                ?? "user_id.eq.\(userId)"

            items = try await db
                .from("notifications")
                .select()
                .or(filter)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute()
                .value
        } catch {
            self.error = "โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่"
            print("[Notifications] load error:", error)
        }
        isLoading = false
    }

    /// Mark a single notification read — optimistic UI update + server write,
    /// matching the web's `markOne()`.
    func markOne(_ id: String) async {
        guard let idx = items.firstIndex(where: { $0.id == id }), items[idx].isUnread else { return }
        let now = isoNow()
        let original = items[idx]
        items[idx] = AppNotification(id: original.id, type: original.type, title: original.title,
                                     body: original.body, readAt: now, createdAt: original.createdAt,
                                     organizationId: original.organizationId, userId: original.userId)
        do {
            try await db.from("notifications")
                .update(["read_at": now])
                .eq("id", value: id)
                .execute()
        } catch {
            print("[Notifications] markOne error:", error) // keep optimistic state — matches web behaviour
        }
    }

    /// Mark every unread item read — matching the web's `markAllRead()`.
    func markAllRead(userId: String, orgId: String?) async {
        guard unreadCount > 0, !marking else { return }
        marking = true
        let now = isoNow()
        let unreadIds = items.filter(\.isUnread).map(\.id)
        for i in items.indices where items[i].isUnread {
            let n = items[i]
            items[i] = AppNotification(id: n.id, type: n.type, title: n.title, body: n.body,
                                       readAt: now, createdAt: n.createdAt,
                                       organizationId: n.organizationId, userId: n.userId)
        }
        do {
            try await db.from("notifications")
                .update(["read_at": now])
                .in("id", values: unreadIds)
                .execute()
        } catch {
            print("[Notifications] markAllRead error:", error)
        }
        marking = false
    }

    private func isoNow() -> String { ISO8601DateFormatter.withFractional.string(from: Date()) }
}
