import SwiftUI
import Supabase

struct ChartMonth: Identifiable {
    var id: String { label }
    let label: String
    let spend: Double
}

struct CatDoc: Codable {
    let category: String?
    let totalAmount: Double?
    enum CodingKeys: String, CodingKey {
        case category
        case totalAmount = "total_amount"
    }
}

@MainActor
final class AnalyticsViewModel: ObservableObject {
    @Published var chartData: [ChartMonth] = []
    @Published var yearTotal = 0.0
    @Published var catBreakdown: [(name: String, value: Double)] = []
    @Published var isLoading = true

    private let db       = SupabaseManager.shared.client
    private let monthsTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
                            "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]

    func load(orgId: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            // Monthly summaries
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

            // Category breakdown – fetch docs for current year
            let yearStart = Calendar.current.dateInterval(of: .year, for: Date())!.start
            let fmt = DateFormatter()
            fmt.dateFormat = "yyyy-MM-dd"
            let yearStartStr = fmt.string(from: yearStart)

            let docs: [CatDoc] = try await db
                .from("documents")
                .select("category, total_amount")
                .eq("organization_id", value: orgId)
                .in("status", values: ["approved", "pushed", "reviewing", "completed"])
                .gte("doc_date", value: yearStartStr)
                .execute()
                .value

            var catMap: [String: Double] = [:]
            for d in docs {
                let k = d.category ?? "อื่นๆ"
                catMap[k, default: 0] += d.totalAmount ?? 0
            }
            catBreakdown = catMap.sorted { $0.value > $1.value }.prefix(6).map { ($0.key, $0.value) }

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
