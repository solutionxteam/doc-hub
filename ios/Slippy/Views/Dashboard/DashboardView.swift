import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var vm = DashboardViewModel()
    @StateObject private var notifVM = NotificationsViewModel()
    @State private var showCamera = false
    @State private var showNotifications = false
    @State private var showChat = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    headerSection
                    heroSummaryCard
                    quickActionsSection
                    if vm.statsReview > 0 {
                        pendingReviewBanner
                    }
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
                if let userId = authVM.session?.user.id.uuidString {
                    await notifVM.load(userId: userId, orgId: orgId)
                }
            }
            .refreshable {
                guard let orgId = authVM.org?.id else { return }
                await vm.load(orgId: orgId)
                if let userId = authVM.session?.user.id.uuidString {
                    await notifVM.load(userId: userId, orgId: orgId)
                }
            }
            .sheet(isPresented: $showCamera) { CameraPickerView() }
            .sheet(isPresented: $showNotifications) {
                NotificationsView().environmentObject(authVM)
            }
            .sheet(isPresented: $showChat) {
                ChatView().environmentObject(authVM)
            }
        }
    }

    // MARK: – Header
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("สวัสดี, \(authVM.profile?.displayName.components(separatedBy: " ").first ?? "คุณ") 👋")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundColor(Color.textPrimary)
                Text(authVM.org?.name ?? "Slippy")
                    .font(.system(size: 13))
                    .foregroundColor(Color.textSecondary)
            }
            Spacer()
            HStack(spacing: 10) {
                Button { hapticLight() } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Color.textPrimary)
                        .frame(width: 40, height: 40)
                        .background(Color.surface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.border, lineWidth: 1))
                }
                // Bell — mirrors the web app-shell header's notification entry,
                // same `notifications` data source & unread badge semantics
                Button { hapticLight(); showNotifications = true } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color.textPrimary)
                            .frame(width: 40, height: 40)
                            .background(Color.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(Color.border, lineWidth: 1))
                        if notifVM.unreadCount > 0 {
                            Text(notifVM.unreadCount > 9 ? "9+" : "\(notifVM.unreadCount)")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 4)
                                .frame(minWidth: 16, minHeight: 16)
                                .background(Color(hex: "#ef4444"))
                                .clipShape(Capsule())
                                .offset(x: 4, y: -4)
                        }
                    }
                }
                Button { hapticLight(); showChat = true } label: {
                    Image(systemName: "sparkles")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 40, height: 40)
                        .background(
                            LinearGradient(colors: [Color.brand500, Color(hex: "#8b5cf6")],
                                           startPoint: .topLeading, endPoint: .bottomTrailing)
                        )
                        .clipShape(Circle())
                }
                Button { showCamera = true } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 40, height: 40)
                        .background(Color.brand500)
                        .clipShape(Circle())
                }
            }
        }
        .padding(.top, 16)
    }

    // MARK: – Hero summary card (gradient, mirrors MHome's spend-summary card)
    private var heroSummaryCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                Text("ยอดใช้จ่ายเดือนนี้")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white.opacity(0.78))
                Spacer()
                Text(monthLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white.opacity(0.85))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.white.opacity(0.16))
                    .clipShape(Capsule())
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(vm.isLoading ? "฿—" : fmtTHB(vm.statsTotal))
                    .font(.system(size: 32, weight: .heavy))
                    .foregroundColor(.white)
                HStack(spacing: 6) {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 11, weight: .bold))
                    Text("เพิ่มขึ้น 8% จากเดือนที่แล้ว")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.white.opacity(0.16))
                .clipShape(Capsule())
            }

            Divider().background(Color.white.opacity(0.22))

            HStack(spacing: 0) {
                heroMiniStat(value: "\(vm.statsDoc)", label: "เอกสาร")
                heroMiniDivider
                heroMiniStat(value: "\(vm.statsReview)", label: "รอตรวจสอบ")
                heroMiniDivider
                heroMiniStat(value: fmtTHB(vm.statsVAT), label: "ภาษีมูลค่าเพิ่ม")
            }
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [Color(hex: "#8b5cf6"), Color(hex: "#6366f1"), Color(hex: "#4338ca")],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .shadow(color: Color.brand500.opacity(0.28), radius: 20, x: 0, y: 12)
    }

    private var heroMiniDivider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.2))
            .frame(width: 1, height: 30)
    }

    private func heroMiniStat(value: String, label: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(.white.opacity(0.75))
        }
        .frame(maxWidth: .infinity)
    }

    private var monthLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "th_TH")
        f.dateFormat = "MMMM"
        return f.string(from: Date())
    }

    // MARK: – Quick actions (4-col icon grid: Capture / Upload / LINE / Email)
    private var quickActionsSection: some View {
        HStack(spacing: 12) {
            quickAction(icon: "camera.fill", title: "ถ่ายภาพ", tint: Color.brand500) {
                showCamera = true
            }
            quickAction(icon: "arrow.up.doc.fill", title: "อัปโหลด", tint: Color(hex: "#3b82f6")) {
                showCamera = true
            }
            quickAction(icon: "bubble.left.and.bubble.right.fill", title: "LINE", tint: Color(hex: "#10b981")) {
                hapticLight()
            }
            quickAction(icon: "envelope.fill", title: "อีเมล", tint: Color(hex: "#f59e0b")) {
                hapticLight()
            }
        }
    }

    private func quickAction(icon: String, title: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button {
            hapticLight()
            action()
        } label: {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(tint)
                    .frame(width: 48, height: 48)
                    .background(tint.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color.textSecondary)
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: – Pending review banner (amber alert)
    private var pendingReviewBanner: some View {
        HStack(spacing: 12) {
            Image(systemName: "clock.fill")
                .font(.system(size: 16))
                .foregroundColor(Color(hex: "#f59e0b"))
                .frame(width: 36, height: 36)
                .background(Color(hex: "#f59e0b").opacity(0.16))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text("มี \(vm.statsReview) เอกสารรอตรวจสอบ")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Color.textPrimary)
                Text("แตะเพื่อตรวจสอบและยืนยันความถูกต้อง")
                    .font(.system(size: 11))
                    .foregroundColor(Color.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color(hex: "#f59e0b"))
        }
        .padding(14)
        .background(Color(hex: "#f59e0b").opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: "#f59e0b").opacity(0.25), lineWidth: 1))
    }

    // MARK: – Recent Docs
    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("เอกสารล่าสุด")
                    .font(.system(size: 15, weight: .bold))
                Spacer()
                NavigationLink("ดูทั้งหมด") {
                    DocumentsView()
                }
                .font(.system(size: 13, weight: .semibold))
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
struct DocRow: View {
    let doc: SlippyDocument

    private var categoryEmoji: String {
        switch doc.category?.lowercased() {
        case "food", "restaurant", "อาหาร":            return "🍽️"
        case "fuel", "transport", "เดินทาง", "น้ำมัน": return "⛽️"
        case "office", "สำนักงาน":                     return "🖇️"
        case "utilities", "สาธารณูปโภค":               return "💡"
        case "shopping", "ช้อปปิ้ง":                   return "🛍️"
        case "travel", "ท่องเที่ยว":                   return "✈️"
        case "tech", "อุปกรณ์":                        return "💻"
        default:                                        return "🧾"
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Text(categoryEmoji)
                .font(.system(size: 19))
                .frame(width: 42, height: 42)
                .background(Color.border.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 3) {
                Text(doc.vendorName ?? doc.fileName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color.textPrimary)
                    .lineLimit(1)
                Text("\(doc.category ?? "ทั่วไป") · \(relTime(doc.createdAt))")
                    .font(.system(size: 12))
                    .foregroundColor(Color.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 5) {
                if let amt = doc.totalAmount {
                    Text(fmtTHB(amt))
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color.textPrimary)
                }
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color(hex: doc.statusColor))
                        .frame(width: 6, height: 6)
                    Text(doc.statusLabel.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(Color(hex: doc.statusColor))
                        .tracking(0.4)
                }
            }
        }
        .padding(12)
        .background(Color.surface)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.border, lineWidth: 1))
    }
}

#if DEBUG
#Preview {
    let vm = AuthViewModel(_preview: true)
    vm.setPreviewData(
        profile: UserProfile(id: "u1", email: "demo@slippy.app", fullName: "สมชาย ใจดี", avatarUrl: nil),
        org: Organization(id: "demo-org", name: "บริษัท Demo จำกัด", plan: "pro", docQuota: 200, docUsed: 45)
    )
    return DashboardView().environmentObject(vm)
}
#endif
