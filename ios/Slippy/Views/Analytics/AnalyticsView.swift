import SwiftUI

struct AnalyticsView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var vm = AnalyticsViewModel()

    private let catColors: [Color] = [.brand500, Color(hex: "#8b5cf6"),
                                       Color(hex: "#06b6d4"), Color(hex: "#10b981"),
                                       Color(hex: "#f97316")]
    private let categories = [
        ("ค่า Software / Cloud", 38200.0),
        ("ค่าเช่าสำนักงาน",      35000.0),
        ("ค่าเดินทาง",           18700.0),
        ("ของใช้สำนักงาน",       14250.0),
        ("อาหารและเครื่องดื่ม",  13420.0),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if vm.isLoading {
                        ProgressView().tint(Color.brand500).padding(40)
                    } else {
                        yearTotalCard
                        barChartCard
                        categoryCard
                        monthlyListCard
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
            }
            .background(Color(hex: "#f8f9fc"))
            .navigationTitle("รายงาน")
            .navigationBarTitleDisplayMode(.large)
            .task {
                guard let orgId = authVM.org?.id else { return }
                await vm.load(orgId: orgId)
            }
        }
    }

    // MARK: – Year total
    private var yearTotalCard: some View {
        VStack(spacing: 8) {
            Text("รวมทั้งปี")
                .font(.system(size: 13, weight: .600))
                .foregroundColor(.white.opacity(0.75))
            Text(fmtTHB(vm.yearTotal))
                .font(.system(size: 34, weight: .900))
                .foregroundColor(.white)
            Text("จาก \(vm.chartData.count) เดือน")
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.65))
        }
        .frame(maxWidth: .infinity)
        .padding(28)
        .background(
            LinearGradient(colors: [Color.brand500, Color.brand600],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .cornerRadius(24)
        .shadow(color: Color.brand500.opacity(0.35), radius: 16, x: 0, y: 8)
    }

    // MARK: – Bar chart
    private var barChartCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("ค่าใช้จ่ายรายเดือน")
                .font(.system(size: 14, weight: .700))
                .foregroundColor(Color.textPrimary)

            MiniBarChart(data: vm.chartData)

            if let latest = vm.chartData.last {
                HStack {
                    Text("เดือนล่าสุด (\(latest.label))")
                        .font(.system(size: 12))
                        .foregroundColor(Color.textSecondary)
                    Spacer()
                    Text(fmtTHB(latest.spend))
                        .font(.system(size: 14, weight: .700))
                        .foregroundColor(Color.brand500)
                }
                .padding(.top, 4)
            }
        }
        .sectionCard()
    }

    // MARK: – Category breakdown
    private var categoryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("แยกตามหมวดหมู่")
                .font(.system(size: 14, weight: .700))
                .foregroundColor(Color.textPrimary)

            let catTotal = categories.reduce(0) { $0 + $1.1 }
            ForEach(Array(categories.enumerated()), id: \.offset) { i, cat in
                VStack(spacing: 4) {
                    HStack {
                        Circle()
                            .fill(catColors[i % catColors.count])
                            .frame(width: 8, height: 8)
                        Text(cat.0)
                            .font(.system(size: 12, weight: .500))
                            .foregroundColor(Color.textPrimary)
                        Spacer()
                        Text(fmtTHB(cat.1))
                            .font(.system(size: 12, weight: .700))
                            .foregroundColor(Color.textPrimary)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.border).frame(height: 4)
                            Capsule()
                                .fill(catColors[i % catColors.count])
                                .frame(width: geo.size.width * (cat.1 / catTotal), height: 4)
                        }
                    }
                    .frame(height: 4)
                }
            }
        }
        .sectionCard()
    }

    // MARK: – Monthly list
    private var monthlyListCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("สรุปรายเดือน")
                .font(.system(size: 14, weight: .700))
                .foregroundColor(Color.textPrimary)
                .padding(.bottom, 12)

            ForEach(vm.chartData.reversed()) { month in
                HStack {
                    Text(month.label)
                        .font(.system(size: 13))
                        .foregroundColor(Color.textPrimary)
                    Spacer()
                    Text(fmtTHB(month.spend))
                        .font(.system(size: 13, weight: .700))
                        .foregroundColor(Color.textPrimary)
                }
                .padding(.vertical, 10)
                if month.label != vm.chartData.first?.label {
                    Divider()
                }
            }
        }
        .sectionCard()
    }
}

// MARK: – Mini bar chart
struct MiniBarChart: View {
    let data: [ChartMonth]

    var body: some View {
        let maxVal = data.map(\.spend).max() ?? 1
        HStack(alignment: .bottom, spacing: 4) {
            ForEach(Array(data.enumerated()), id: \.offset) { i, month in
                VStack(spacing: 4) {
                    Capsule()
                        .fill(i == data.count - 1
                              ? Color.brand500
                              : Color.brand500.opacity(0.25))
                        .frame(height: max(4, CGFloat(month.spend / maxVal) * 64))
                    Text(month.label)
                        .font(.system(size: 8))
                        .foregroundColor(Color.textSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 80)
    }
}
