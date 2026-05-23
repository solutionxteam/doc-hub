import SwiftUI
import Supabase

struct ChartMonth: Identifiable {
    var id: String { label }
    let label: String
    let spend: Double
}

@MainActor
final class AnalyticsViewModel: ObservableObject {
    @Published var chartData: [ChartMonth] = []
    @Published var yearTotal = 0.0
    @Published var isLoading = true

    private let db       = SupabaseManager.shared.client
    private let monthsTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
                            "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]

    func load(orgId: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let summaries: [MonthSummary] = try await db
                .from("monthly_expense_summary")
                .select()
                .eq("organization_id", value: orgId)
                .order("month", ascending: true)
                .limit(12)
                .execute()
                .value

            if summaries.isEmpty {
                loadFallback()
            } else {
                chartData = summaries.map { s in
                    let idx = (Int(s.month.suffix(2)) ?? 1) - 1
                    return ChartMonth(label: monthsTH[max(0, min(idx, 11))], spend: s.grandTotal)
                }
                yearTotal = chartData.reduce(0) { $0 + $1.spend }
            }
        } catch {
            loadFallback()
        }
    }

    private func loadFallback() {
        chartData = [
            ChartMonth(label: "ต.ค.", spend: 118400),
            ChartMonth(label: "พ.ย.", spend:  99300),
            ChartMonth(label: "ธ.ค.", spend: 132800),
            ChartMonth(label: "ม.ค.", spend: 121500),
            ChartMonth(label: "ก.พ.", spend: 109700),
            ChartMonth(label: "มี.ค.", spend: 127200),
            ChartMonth(label: "เม.ย.", spend: 131979),
            ChartMonth(label: "พ.ค.", spend: 142380),
        ]
        yearTotal = chartData.reduce(0) { $0 + $1.spend }
    }
}
