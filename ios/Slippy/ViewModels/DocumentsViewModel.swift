import SwiftUI
import Supabase

@MainActor
final class DocumentsViewModel: ObservableObject {
    @Published var documents: [SlippyDocument] = []
    @Published var searchText  = ""
    @Published var filterStatus: String? = nil
    @Published var isLoading   = false
    @Published var error: String?

    private let db = SupabaseManager.shared.client
    private var orgId = ""

    func load(orgId: String) async {
        self.orgId = orgId
        await fetch()
    }

    func applyFilter(status: String?) async {
        filterStatus = status
        await fetch()
    }

    func search(query: String) async {
        searchText = query
        await fetch()
    }

    private func fetch() async {
        isLoading = true
        defer { isLoading = false }
        do {
            var query = db
                .from("documents")
                .select()
                .eq("organization_id", value: orgId)

            if let status = filterStatus {
                query = query.eq("status", value: status)
            }
            if !searchText.isEmpty {
                query = query.ilike("vendor_name", pattern: "%\(searchText)%")
            }

            documents = try await query
                .order("created_at", ascending: false)
                .limit(50)
                .execute()
                .value
        } catch {
            self.error = error.localizedDescription
        }
    }
}
