import SwiftUI
import LocalAuthentication
import Supabase

private enum ProfileTab: String, CaseIterable, Identifiable {
    case info = "ข้อมูลส่วนตัว"
    case notifications = "การแจ้งเตือน"
    case security = "ความปลอดภัย"
    var id: String { rawValue }
}

struct ProfileView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var biometric      = false
    @State private var lineNotif      = true
    @State private var weeklyRpt      = false
    @State private var docNotif       = true
    @State private var showLogoutAlert = false
    @State private var loggingOut     = false
    @State private var tab: ProfileTab = .info
    @State private var showEditName = false
    @State private var showOrgSwitcher = false
    @State private var editedName = ""
    @State private var savingName = false

    private var role: String { authVM.membership?.role ?? "member" }
    private let roleColors: [String: Color] = [
        "owner": Color(hex: "#f59e0b"), "admin": Color(hex: "#8b5cf6"),
        "accountant": Color(hex: "#6366f1"), "member": Color(hex: "#94a3b8")
    ]
    private let roleLabels: [String: String] = [
        "owner":"OWNER","admin":"ADMIN","accountant":"ACCOUNTANT","member":"MEMBER"
    ]

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                ScrollView {
                    VStack(spacing: 0) {
                        heroCard
                        tabBar
                            .padding(.top, 20)

                        switch tab {
                        case .info:          infoTabContent
                        case .notifications: notificationsTabContent
                        case .security:      securityTabContent
                        }

                        logoutButton
                    }
                    .padding(.bottom, 100)
                }
                .background(Color.background)
                .navigationBarTitleDisplayMode(.inline)
                .onAppear {
                    biometric = UserDefaults.standard.bool(forKey: "slippy_biometric")
                    lineNotif  = UserDefaults.standard.bool(forKey: "slippy_line_notif")
                    weeklyRpt  = UserDefaults.standard.bool(forKey: "slippy_weekly_rpt")
                    docNotif   = UserDefaults.standard.bool(forKey: "slippy_doc_notif")
                }

                // Floating support / chat button (matches web FAB)
                Button {
                    UIApplication.shared.open(URL(string: "mailto:hello@slippy.app")!)
                } label: {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 54, height: 54)
                        .background(
                            LinearGradient(colors: [Color(hex: "#8b5cf6"), Color(hex: "#6366f1")],
                                           startPoint: .topLeading, endPoint: .bottomTrailing)
                        )
                        .clipShape(Circle())
                        .shadow(color: Color(hex: "#6366f1").opacity(0.4), radius: 14, x: 0, y: 6)
                }
                .padding(.trailing, 20)
                .padding(.bottom, 24)
            }
        }
        .alert("ออกจากระบบ", isPresented: $showLogoutAlert) {
            Button("ยกเลิก", role: .cancel) {}
            Button("ออกจากระบบ", role: .destructive) {
                Task {
                    loggingOut = true
                    await authVM.signOut()
                }
            }
        } message: {
            Text("คุณต้องการออกจากระบบหรือไม่?")
        }
        .sheet(isPresented: $showEditName) {
            NavigationStack {
                Form {
                    Section("ชื่อ-นามสกุล") {
                        TextField("ชื่อ-นามสกุล", text: $editedName)
                    }
                }
                .navigationTitle("แก้ไขโปรไฟล์")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("ยกเลิก") { showEditName = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            savingName = true
                            Task {
                                let ok = await authVM.updateProfile(fullName: editedName)
                                savingName = false
                                if ok { showEditName = false }
                            }
                        } label: {
                            if savingName { ProgressView() } else { Text("บันทึก").bold() }
                        }
                        .disabled(savingName || editedName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
            .presentationDetents([.height(220)])
        }
    }

    // MARK: – Hero card (gradient cover + avatar, matches web profile header)
    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                // Gradient cover banner with subtle dotted texture
                LinearGradient(
                    colors: [Color(hex: "#4338ca"), Color(hex: "#7c3aed"), Color(hex: "#c026d3")],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                .frame(height: 110)
                .overlay(DotPattern().opacity(0.18))

                Button {} label: {
                    HStack(spacing: 6) {
                        Image(systemName: "pencil")
                            .font(.system(size: 12, weight: .semibold))
                        Text("แก้ไขโปรไฟล์")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(Color.black.opacity(0.28))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Color.white.opacity(0.18), lineWidth: 1))
                }
                .padding(16)
            }

            // Avatar overlapping the banner
            ZStack(alignment: .bottomTrailing) {
                InitialsAvatar(text: authVM.profile?.initials ?? "?",
                               size: 84, color: roleColors[role] ?? .brand500)
                    .overlay(Circle().stroke(Color.surface, lineWidth: 4))
                Circle().fill(Color(hex: "#10b981"))
                    .frame(width: 18, height: 18)
                    .overlay(Circle().stroke(Color.surface, lineWidth: 3))
            }
            .padding(.top, -42)
            .padding(.leading, 20)

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(authVM.profile?.displayName ?? "—")
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundColor(Color.textPrimary)
                    Text(roleLabels[role] ?? role.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.5)
                        .foregroundColor(roleColors[role] ?? .brand500)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background((roleColors[role] ?? .brand500).opacity(0.16))
                        .clipShape(Capsule())
                }

                Text(authVM.session?.user.email ?? authVM.profile?.email ?? "—")
                    .font(.system(size: 14))
                    .foregroundColor(Color.textSecondary)

                HStack(spacing: 16) {
                    if let org = authVM.org {
                        HStack(spacing: 6) {
                            Image(systemName: "building.2")
                                .font(.system(size: 12))
                                .foregroundColor(Color.textSecondary)
                            Text(org.name)
                                .font(.system(size: 12.5))
                                .foregroundColor(Color.textSecondary)
                            Text(org.plan.uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(Color.brand500)
                                .padding(.horizontal, 7).padding(.vertical, 2)
                                .background(Color.brand500.opacity(0.14))
                                .clipShape(Capsule())
                        }
                    }
                    HStack(spacing: 6) {
                        Image(systemName: "clock")
                            .font(.system(size: 12))
                            .foregroundColor(Color.textSecondary)
                        Text("เข้าร่วม \(joinedDateString)")
                            .font(.system(size: 12.5))
                            .foregroundColor(Color.textSecondary)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 20)
        }
        .background(Color.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.border, lineWidth: 1))
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private var joinedDateString: String {
        guard let date = authVM.session?.user.createdAt else { return "—" }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "th_TH")
        fmt.dateFormat = "MMMM yyyy"
        return fmt.string(from: date)
    }

    // MARK: – Tab bar (segmented pill — matches web tabs)
    private var tabBar: some View {
        HStack(spacing: 4) {
            ForEach(ProfileTab.allCases) { t in
                let selected = tab == t
                Button { withAnimation(.easeInOut(duration: 0.18)) { tab = t } } label: {
                    Text(t.rawValue)
                        .font(.system(size: 13, weight: selected ? .bold : .medium))
                        .foregroundColor(selected ? Color.textOnBrand : Color.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(selected ? Color.surfaceMuted : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
        .padding(4)
        .background(Color.inputBg)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))
        .padding(.horizontal, 16)
    }

    // MARK: – Tab: ข้อมูลส่วนตัว
    private var infoTabContent: some View {
        VStack(alignment: .leading, spacing: 22) {
            groupHeader("บัญชี")
            VStack(spacing: 10) {
                Button {
                    hapticLight()
                    editedName = authVM.profile?.fullName ?? authVM.profile?.displayName ?? ""
                    showEditName = true
                } label: {
                    HStack {
                        iconInfoRow(icon: "person", label: "ชื่อ-นามสกุล",
                                    value: authVM.profile?.displayName ?? "—")
                        Image(systemName: "pencil")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Color.textSecondary)
                    }
                }
                .buttonStyle(.plain)
                iconInfoRow(icon: "envelope", label: "อีเมล",
                            value: authVM.session?.user.email ?? "—", emphasised: true)
            }

            groupHeader("องค์กรและบทบาท")
            Button {
                if authVM.memberships.count > 1 {
                    hapticLight()
                    showOrgSwitcher = true
                }
            } label: {
                HStack(spacing: 14) {
                    iconBadge("building.2", tint: Color.brand500)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("องค์กรปัจจุบัน")
                            .font(.system(size: 12.5)).foregroundColor(Color.textSecondary)
                        Text(authVM.org?.name ?? "—")
                            .font(.system(size: 16, weight: .bold)).foregroundColor(Color.textPrimary)
                    }
                    Spacer()
                    Text(roleLabels[role] ?? role.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(roleColors[role] ?? .brand500)
                        .padding(.horizontal, 11).padding(.vertical, 5)
                        .background((roleColors[role] ?? .brand500).opacity(0.16))
                        .clipShape(Capsule())
                    if authVM.memberships.count > 1 {
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color.textSecondary)
                    }
                }
                .padding(16)
                .background(Color.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .confirmationDialog("สลับองค์กร", isPresented: $showOrgSwitcher, titleVisibility: .visible) {
                ForEach(authVM.memberships, id: \.organizations.id) { m in
                    Button(m.organizations.name) {
                        authVM.switchOrg(to: m.organizations.id)
                    }
                }
                Button("ยกเลิก", role: .cancel) {}
            }

            groupHeader("บัญชีที่เชื่อมต่อ")
            VStack(spacing: 10) {
                connectedAccountRow(
                    icon: "bubble.left.fill", iconBg: Color(hex: "#06C755"),
                    title: "LINE",
                    subtitle: "\(authVM.profile?.displayName ?? "—") · เชื่อมเมื่อ \(joinedDateString)",
                    actionTitle: "ยกเลิก", actionColor: Color(hex: "#ef4444"), enabled: true
                ) {}
                connectedAccountRow(
                    icon: "iphone", iconBg: Color(hex: "#1f2937"),
                    title: "Mobile App",
                    subtitle: "เร็วๆ นี้",
                    actionTitle: "เร็วๆ นี้", actionColor: Color.textSecondary, enabled: false
                ) {}
            }

            groupHeader("กิจกรรมล่าสุด")
            VStack(spacing: 8) {
                Text("ยังไม่มีกิจกรรม")
                    .font(.system(size: 14))
                    .foregroundColor(Color.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 28)
            }
            .background(Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))
        }
        .padding(.horizontal, 16)
        .padding(.top, 22)
    }

    // MARK: – Tab: การแจ้งเตือน
    private var notificationsTabContent: some View {
        VStack(alignment: .leading, spacing: 22) {
            groupHeader("ช่องทางการแจ้งเตือน")
            VStack(spacing: 0) {
                toggleRow("แจ้งเตือนผ่าน LINE", sub: "Push ผ่าน Slippy Bot", value: $lineNotif)
                    .onChange(of: lineNotif) { _, v in
                        UserDefaults.standard.set(v, forKey: "slippy_line_notif")
                    }
                rowDivider
                toggleRow("แจ้งเตือนเอกสารใหม่", sub: "เมื่อ AI ประมวลผลเอกสารเสร็จ", value: $docNotif)
                    .onChange(of: docNotif) { _, v in
                        UserDefaults.standard.set(v, forKey: "slippy_doc_notif")
                    }
                rowDivider
                toggleRow("รายงานรายสัปดาห์", sub: "สรุปทุกวันจันทร์", value: $weeklyRpt)
                    .onChange(of: weeklyRpt) { _, v in
                        UserDefaults.standard.set(v, forKey: "slippy_weekly_rpt")
                    }
            }
            .background(Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))
        }
        .padding(.horizontal, 16)
        .padding(.top, 22)
    }

    // MARK: – Tab: ความปลอดภัย
    private var securityTabContent: some View {
        VStack(alignment: .leading, spacing: 22) {
            groupHeader("การยืนยันตัวตน")
            VStack(spacing: 0) {
                toggleRow("Biometric Login", sub: "Face ID / Touch ID", value: $biometric)
                    .onChange(of: biometric) { _, v in
                        UserDefaults.standard.set(v, forKey: "slippy_biometric")
                        if v { Task { await checkBiometric() } }
                    }
            }
            .background(Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))

            groupHeader("เครื่องมือทางบัญชี")
            VStack(spacing: 0) {
                NavigationLink {
                    VendorsView().environmentObject(authVM)
                } label: {
                    actionRowLabel("ผู้ขาย / Vendors", icon: "building.2.fill")
                }
                rowDivider
                NavigationLink {
                    TaxView().environmentObject(authVM)
                } label: {
                    actionRowLabel("ภาษี VAT / หัก ณ ที่จ่าย", icon: "percent")
                }
            }
            .background(Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))

            groupHeader("การดำเนินการ")
            VStack(spacing: 0) {
                actionRow("เปลี่ยนรหัสผ่าน", icon: "key.fill") {
                    Task {
                        let email = authVM.session?.user.email ?? ""
                        try? await SupabaseManager.shared.client.auth.resetPasswordForEmail(email)
                    }
                }
                rowDivider
                NavigationLink {
                    BillingView().environmentObject(authVM)
                } label: {
                    actionRowLabel("จัดการแผน / Billing", icon: "chart.bar.fill")
                }
                rowDivider
                actionRow("ติดต่อฝ่ายสนับสนุน", icon: "bubble.left.and.bubble.right.fill") {
                    UIApplication.shared.open(URL(string: "mailto:hello@slippy.app")!)
                }
                rowDivider
                actionRow("นโยบายความเป็นส่วนตัว", icon: "lock.shield.fill") {
                    UIApplication.shared.open(URL(string: "https://slippy.app/privacy-policy")!)
                }
            }
            .background(Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))

            groupHeader("เกี่ยวกับแอป")
            VStack(spacing: 0) {
                infoRow("เวอร์ชัน", Config.appVersion)
                rowDivider
                infoRow("Build", "iOS Native")
            }
            .background(Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))
        }
        .padding(.horizontal, 16)
        .padding(.top, 22)
    }

    // MARK: – Logout
    private var logoutButton: some View {
        Button { showLogoutAlert = true } label: {
            HStack {
                if loggingOut {
                    ProgressView().tint(Color(hex: "#ef4444"))
                } else {
                    Image(systemName: "arrow.left.circle")
                    Text("ออกจากระบบ").font(.system(size: 15, weight: .bold))
                }
            }
            .foregroundColor(Color(hex: "#ef4444"))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color(hex: "#ef4444").opacity(0.10))
            .cornerRadius(16)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "#ef4444").opacity(0.35)))
        }
        .padding(.horizontal, 16)
        .padding(.top, 28)
    }

    // MARK: – Shared row builders
    private var rowDivider: some View {
        Divider().padding(.leading, 56).overlay(Color.border)
    }

    @ViewBuilder
    private func groupHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(Color.textSecondary)
    }

    @ViewBuilder
    private func iconBadge(_ symbol: String, tint: Color) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 16, weight: .semibold))
            .foregroundColor(tint)
            .frame(width: 42, height: 42)
            .background(tint.opacity(0.14))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func iconInfoRow(_ symbol: String? = nil, icon: String, label: String, value: String, emphasised: Bool = false) -> some View {
        HStack(spacing: 14) {
            iconBadge(icon, tint: Color.textSecondary)
            VStack(alignment: .leading, spacing: 3) {
                Text(label).font(.system(size: 12.5)).foregroundColor(Color.textSecondary)
                Text(value)
                    .font(.system(size: emphasised ? 16 : 15, weight: emphasised ? .bold : .semibold))
                    .foregroundColor(Color.textPrimary)
            }
            Spacer()
        }
        .padding(16)
        .background(Color.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))
    }

    @ViewBuilder
    private func connectedAccountRow(icon: String, iconBg: Color, title: String, subtitle: String,
                                       actionTitle: String, actionColor: Color, enabled: Bool,
                                       action: @escaping () -> Void) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 42, height: 42)
                .background(iconBg)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 15, weight: .bold)).foregroundColor(Color.textPrimary)
                Text(subtitle).font(.system(size: 12.5)).foregroundColor(Color.textSecondary)
            }
            Spacer()
            Button(action: { hapticLight(); action() }) {
                Text(actionTitle)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundColor(actionColor)
                    .padding(.horizontal, 13).padding(.vertical, 7)
                    .background(actionColor.opacity(enabled ? 0.12 : 0.08))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(actionColor.opacity(enabled ? 0.4 : 0.2), lineWidth: 1))
            }
            .disabled(!enabled)
        }
        .padding(16)
        .background(Color.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border, lineWidth: 1))
    }

    @ViewBuilder
    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 14)).foregroundColor(Color.textSecondary)
            Spacer()
            Text(value).font(.system(size: 14, weight: .semibold)).foregroundColor(Color.textPrimary)
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
    }

    @ViewBuilder
    private func toggleRow(_ label: String, sub: String, value: Binding<Bool>) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.system(size: 14, weight: .semibold)).foregroundColor(Color.textPrimary)
                Text(sub).font(.system(size: 11)).foregroundColor(Color.textSecondary)
            }
            Spacer()
            Toggle("", isOn: value).tint(Color.brand500).labelsHidden()
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
    }

    @ViewBuilder
    /// Visual content shared by `actionRow` (button) and `NavigationLink` rows —
    /// same look, but usable as a plain label for navigation destinations.
    private func actionRowLabel(_ label: String, icon: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(Color.brand500)
                .frame(width: 32, height: 32)
                .background(Color.brand500.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 9))
            Text(label).font(.system(size: 14, weight: .medium)).foregroundColor(Color.textPrimary)
            Spacer()
            Image(systemName: "chevron.right").foregroundColor(Color.textSecondary).font(.system(size: 13))
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .contentShape(Rectangle())
    }

    private func actionRow(_ label: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: { hapticLight(); action() }) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color.brand500)
                    .frame(width: 32, height: 32)
                    .background(Color.brand500.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                Text(label).font(.system(size: 14, weight: .medium)).foregroundColor(Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.right").foregroundColor(Color.textSecondary).font(.system(size: 13))
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
        }
    }

    #if DEBUG
    static func preview() -> some View {
        let vm = AuthViewModel(_preview: true)
        vm.setPreviewData(
            profile: UserProfile(id: "u1", email: "demo@slippy.app", fullName: "สมชาย ใจดี", avatarUrl: nil),
            org: Organization(id: "demo-org", name: "บริษัท Demo จำกัด", plan: "pro", docQuota: 200, docUsed: 45),
            role: "owner"
        )
        return ProfileView().environmentObject(vm)
    }
    #endif

    private func checkBiometric() async {
        let ctx = LAContext()
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else {
            biometric = false
            return
        }
        do {
            let ok = try await ctx.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "ยืนยันตัวตนเพื่อเปิด Biometric Login"
            )
            biometric = ok
            if ok { hapticSuccess() }
        } catch {
            biometric = false
        }
    }
}

/// Subtle dotted texture overlay used on the gradient cover banner —
/// recreates the web's faint dot-grid pattern.
private struct DotPattern: View {
    var body: some View {
        Canvas { ctx, size in
            let spacing: CGFloat = 16
            let radius: CGFloat = 1.1
            var y: CGFloat = spacing / 2
            while y < size.height {
                var x: CGFloat = spacing / 2
                while x < size.width {
                    let rect = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
                    ctx.fill(Path(ellipseIn: rect), with: .color(.white.opacity(0.5)))
                    x += spacing
                }
                y += spacing
            }
        }
    }
}

#if DEBUG
#Preview {
    ProfileView.preview()
}
#endif
