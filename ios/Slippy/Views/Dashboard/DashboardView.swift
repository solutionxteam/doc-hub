import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var vm = DashboardViewModel()
    @State private var showCamera = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    headerSection
                    if vm.isLoading {
                        statsPlaceholder
                    } else {
                        statsSection
                    }
                    quotaSection
                    recentSection
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
            }
            .background(Color(hex: "#f8f9fc"))
            .navigationBarHidden(true)
            .task {
                guard let orgId = authVM.org?.id else { return }
                await vm.load(orgId: orgId)
            }
            .refreshable {
                guard let orgId = authVM.org?.id else { return }
                await vm.load(orgId: orgId)
            }
            .sheet(isPresented: $showCamera) { CameraPickerView() }
        }
    }

    // MARK: – Header
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("สวัสดี, \(authVM.profile?.displayName.components(separatedBy: " ").first ?? "คุณ") 👋")
                    .font(.system(size: 22, weight: .800))
                    .foregroundColor(Color.textPrimary)
                Text(authVM.org?.name ?? "Slippy")
                    .font(.system(size: 13))
                    .foregroundColor(Color.textSecondary)
            }
            Spacer()
            Button { showCamera = true } label: {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .700))
                    .foregroundColor(.white)
                    .frame(width: 40, height: 40)
                    .background(Color.brand500)
                    .clipShape(Circle())
            }
        }
        .padding(.top, 16)
    }

    // MARK: – Stats
    private var statsSection: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(title: "เอกสารเดือนนี้", value: "\(vm.statsDoc)",
                     icon: "doc.text",       color: .brand500)
            StatCard(title: "ยอดรวม",         value: fmtTHB(vm.statsTotal),
                     icon: "banknote",        color: Color(hex: "#10b981"))
            StatCard(title: "ภาษีมูลค่าเพิ่ม",  value: fmtTHB(vm.statsVAT),
                     icon: "percent",          color: Color(hex: "#f59e0b"))
            StatCard(title: "รอตรวจสอบ",     value: "\(vm.statsReview)",
                     icon: "clock.badge.exclamationmark", color: Color(hex: "#8b5cf6"))
        }
    }

    private var statsPlaceholder: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.border)
                    .frame(height: 90)
                    .shimmer()
            }
        }
    }

    // MARK: – Quota
    private var quotaSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("โควต้าเอกสาร")
                    .font(.system(size: 13, weight: .700))
                    .foregroundColor(Color.textPrimary)
                Spacer()
                if let org = authVM.org {
                    Text("\(org.docUsed) / \(org.docQuota)")
                        .font(.system(size: 12, weight: .600))
                        .foregroundColor(Color.textSecondary)
                }
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.border).frame(height: 8)
                    Capsule()
                        .fill(LinearGradient(
                            colors: [Color.brand500, Color.brand400],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        .frame(width: geo.size.width * CGFloat(authVM.org?.quotaPercent ?? 0),
                               height: 8)
                        .animation(.easeOut, value: authVM.org?.quotaPercent)
                }
            }
            .frame(height: 8)
        }
        .sectionCard()
    }

    // MARK: – Recent Docs
    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("เอกสารล่าสุด")
                    .font(.system(size: 15, weight: .700))
                Spacer()
                NavigationLink("ดูทั้งหมด") {
                    DocumentsView()
                }
                .font(.system(size: 13, weight: .600))
                .foregroundColor(Color.brand500)
            }

            if vm.recentDocs.isEmpty && !vm.isLoading {
                emptyState
            } else {
                ForEach(vm.recentDocs) { doc in
                    DocRow(doc: doc)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: 36))
                .foregroundColor(Color.border)
            Text("ยังไม่มีเอกสาร")
                .font(.system(size: 14))
                .foregroundColor(Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(40)
    }
}

// MARK: – Sub-components
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundColor(color)
                .frame(width: 40, height: 40)
                .background(color.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.system(size: 18, weight: .800))
                    .foregroundColor(Color.textPrimary)
                Text(title)
                    .font(.system(size: 11))
                    .foregroundColor(Color.textSecondary)
                    .lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.surface)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))
    }
}

struct DocRow: View {
    let doc: SlippyDocument
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "doc.text.fill")
                .font(.system(size: 18))
                .foregroundColor(Color.brand500)
                .frame(width: 40, height: 40)
                .background(Color.brand50)
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 3) {
                Text(doc.vendorName ?? doc.fileName)
                    .font(.system(size: 14, weight: .600))
                    .foregroundColor(Color.textPrimary)
                    .lineLimit(1)
                Text(relTime(doc.createdAt))
                    .font(.system(size: 12))
                    .foregroundColor(Color.textSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                if let amt = doc.totalAmount {
                    Text(fmtTHB(amt))
                        .font(.system(size: 14, weight: .700))
                        .foregroundColor(Color.textPrimary)
                }
                StatusBadge(status: doc.status)
            }
        }
        .padding(12)
        .background(Color.surface)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.border, lineWidth: 1))
    }
}

// MARK: – Shimmer modifier
extension View {
    func shimmer() -> some View { self.opacity(0.5) }
}
