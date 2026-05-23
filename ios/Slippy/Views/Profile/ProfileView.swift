import SwiftUI
import LocalAuthentication

struct ProfileView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var biometric      = false
    @State private var lineNotif      = true
    @State private var weeklyRpt      = false
    @State private var showLogoutAlert = false
    @State private var loggingOut     = false

    private var role: String { authVM.membership?.role ?? "member" }
    private let roleColors: [String: Color] = [
        "owner": .brand500, "admin": Color(hex: "#8b5cf6"),
        "accountant": Color(hex: "#6366f1"), "member": Color(hex: "#94a3b8")
    ]
    private let roleLabels: [String: String] = [
        "owner":"Owner","admin":"Admin","accountant":"Accountant","member":"Member"
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    heroSection
                    accountSection
                    preferencesSection
                    actionsSection
                    appInfoSection
                    logoutButton
                }
                .padding(.bottom, 40)
            }
            .background(Color(hex: "#f8f9fc"))
            .navigationTitle("โปรไฟล์")
            .navigationBarTitleDisplayMode(.large)
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
    }

    // MARK: – Hero
    private var heroSection: some View {
        VStack(spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                InitialsAvatar(text: authVM.profile?.initials ?? "?",
                               size: 88, color: roleColors[role] ?? .brand500)
                Circle().fill(Color(hex: "#10b981"))
                    .frame(width: 18, height: 18)
                    .overlay(Circle().stroke(Color(hex: "#f8f9fc"), lineWidth: 3))
            }
            Text(authVM.profile?.displayName ?? "—")
                .font(.system(size: 22, weight: .800))
                .foregroundColor(Color.textPrimary)
            Text(authVM.session?.user.email ?? "—")
                .font(.system(size: 14))
                .foregroundColor(Color.textSecondary)

            Text(roleLabels[role] ?? role)
                .font(.system(size: 12, weight: .700))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundColor(roleColors[role] ?? .brand500)
                .padding(.horizontal, 14).padding(.vertical, 5)
                .background((roleColors[role] ?? .brand500).opacity(0.12))
                .clipShape(Capsule())

            if let org = authVM.org {
                Text("\(org.name) · \(org.plan.uppercased())")
                    .font(.system(size: 12))
                    .foregroundColor(Color.textSecondary)
            }
        }
        .padding(.vertical, 28)
        .frame(maxWidth: .infinity)
        .background(Color.surface)
        .overlay(Divider(), alignment: .bottom)
    }

    // MARK: – Account Info
    private var accountSection: some View {
        sectionContainer("บัญชี") {
            infoRow("ชื่อ-นามสกุล", authVM.profile?.displayName ?? "—")
            Divider().padding(.leading, 20)
            infoRow("อีเมล",         authVM.session?.user.email ?? "—")
            Divider().padding(.leading, 20)
            infoRow("บทบาท",         roleLabels[role] ?? role)
        }
    }

    // MARK: – Preferences
    private var preferencesSection: some View {
        sectionContainer("การตั้งค่า") {
            toggleRow("Biometric Login", sub: "Face ID / Touch ID", value: $biometric)
                .onChange(of: biometric) { _, v in
                    if v { Task { await checkBiometric() } }
                }
            Divider().padding(.leading, 20)
            toggleRow("แจ้งเตือนผ่าน LINE", sub: "Push ผ่าน Slippy Bot", value: $lineNotif)
            Divider().padding(.leading, 20)
            toggleRow("รายงานรายสัปดาห์", sub: "สรุปทุกวันจันทร์", value: $weeklyRpt)
        }
    }

    // MARK: – Quick Actions
    private var actionsSection: some View {
        sectionContainer("การดำเนินการ") {
            actionRow("🔑 เปลี่ยนรหัสผ่าน") {}
            Divider().padding(.leading, 20)
            actionRow("📱 อุปกรณ์ที่เข้าสู่ระบบ") {}
            Divider().padding(.leading, 20)
            actionRow("💬 ติดต่อฝ่ายสนับสนุน") {}
        }
    }

    // MARK: – App info
    private var appInfoSection: some View {
        sectionContainer("เกี่ยวกับแอป") {
            infoRow("เวอร์ชัน", Config.appVersion)
            Divider().padding(.leading, 20)
            infoRow("Build", "iOS Native")
        }
    }

    // MARK: – Logout
    private var logoutButton: some View {
        Button { showLogoutAlert = true } label: {
            HStack {
                if loggingOut {
                    ProgressView().tint(Color(hex: "#ef4444"))
                } else {
                    Image(systemName: "arrow.left.circle")
                    Text("ออกจากระบบ").font(.system(size: 15, weight: .700))
                }
            }
            .foregroundColor(Color(hex: "#ef4444"))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color(hex: "#fef2f2"))
            .cornerRadius(16)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "#fecaca")))
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
    }

    // MARK: – Helpers
    @ViewBuilder
    private func sectionContainer<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.system(size: 11, weight: .700))
                .foregroundColor(Color.textSecondary)
                .textCase(.uppercase)
                .tracking(1)
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 8)

            VStack(spacing: 0) { content() }
                .background(Color.surface)
                .cornerRadius(16)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border))
                .padding(.horizontal, 20)
        }
    }

    @ViewBuilder
    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 14)).foregroundColor(Color.textSecondary)
            Spacer()
            Text(value).font(.system(size: 14, weight: .600)).foregroundColor(Color.textPrimary)
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
    }

    @ViewBuilder
    private func toggleRow(_ label: String, sub: String, value: Binding<Bool>) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.system(size: 14, weight: .600)).foregroundColor(Color.textPrimary)
                Text(sub).font(.system(size: 11)).foregroundColor(Color.textSecondary)
            }
            Spacer()
            Toggle("", isOn: value).tint(Color.brand500).labelsHidden()
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
    }

    @ViewBuilder
    private func actionRow(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: { hapticLight(); action() }) {
            HStack {
                Text(label).font(.system(size: 14)).foregroundColor(Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.right").foregroundColor(Color.textSecondary).font(.system(size: 13))
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
        }
    }

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
