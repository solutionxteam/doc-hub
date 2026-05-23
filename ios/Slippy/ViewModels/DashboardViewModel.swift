import SwiftUI
import Supabase

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var recentDocs: [SlippyDocument] = []
    @Published var statsDoc     = 0
    @Published var statsTotal   = 0.0
    @Published var statsVAT     = 0.0
    @Published var statsReview  = 0
    @Published var isLoading    = true
    @Published var error: String?

    private let db = SupabaseManager.shared.client

    func load(orgId: String) async {
        isLoading = true
        defer { isLoading = false }
        async let docsTask  = fetchRecent(orgId: orgId)
        async let statsTask = fetchMonthStats(orgId: orgId)
        do {
            let (docs, month) = try await (docsTask, statsTask)
            recentDocs  = docs
            statsDoc    = month.docCount
            statsTotal  = month.grandTotal
            statsVAT    = month.vatTotal
            statsReview = docs.filter { $0.status == "reviewing" }.count
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func fetchRecent(orgId: String) async throws -> [SlippyDocument] {
        try await db
            .from("documents")
            .select()
            .eq("organization_id", value: orgId)
            .order("created_at", ascending: false)
            .limit(10)
            .execute()
            .value
    }

    private func fetchMonthStats(orgId: String) async throws -> MonthSummary {
        let month = currentMonthString()
        let results: [MonthSummary] = try await db
            .from("monthly_expense_summary")
            .select()
            .eq("organization_id", value: orgId)
            .eq("month", value: month)
            .limit(1)
            .execute()
            .value
        return results.first ?? MonthSummary(
            id: "", organizationId: orgId, month: month,
            docCount: 0, grandTotal: 0, vatTotal: 0
        )
    }

    private func currentMonthString() -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM"
        return fmt.string(from: Date())
    }
}
