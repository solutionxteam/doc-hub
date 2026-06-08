import SwiftUI
import Supabase

// MARK: – Colour palette
// Mirrors the web login page's adaptive light/dark CSS variables
// (`globals.css` :root vs .dark) — driven by the system/user display-mode
// toggle (`AppSettings`/`ThemePicker`) instead of being hard-locked to dark.
private struct LoginPalette {
    let bg, card, inputBg, demoBg: Color
    let border, demoBorder: Color
    let text, muted, brand, brand2, brandLt, forgotPw: Color
    let fbBlue, lineGrn, glow1, glow2: Color
    let gradientTop, gradientBottom: Color

    static let dark = LoginPalette(
        bg:        Color(hex: "#0a0d1a"),
        card:      Color(hex: "#111827"),
        inputBg:   Color(hex: "#0f172a"),
        demoBg:    Color(hex: "#1e1b4b"),
        border:    Color(hex: "#1f2937"),
        demoBorder: Color(hex: "#3730a3"),
        text:      .white,
        muted:     Color(hex: "#9ca3af"),
        brand:     Color(hex: "#6366f1"),
        brand2:    Color(hex: "#4f46e5"),
        brandLt:   Color(hex: "#a5b4fc"),
        forgotPw:  Color(hex: "#818cf8"),
        fbBlue:    Color(hex: "#1877F2"),
        lineGrn:   Color(hex: "#06C755"),
        glow1:     Color(hex: "#6366f1"),
        glow2:     Color(hex: "#7c3aed"),
        gradientTop:    Color(hex: "#070a18"),
        gradientBottom: Color(hex: "#0f1235")
    )

    static let light = LoginPalette(
        bg:        Color(hex: "#ffffff"),
        card:      Color(hex: "#ffffff"),
        inputBg:   Color(hex: "#f9fafb"),
        demoBg:    Color(hex: "#eef2ff"),
        border:    Color(hex: "#e5e7eb"),
        demoBorder: Color(hex: "#c7d2fe"),
        text:      Color(hex: "#0f172a"),
        muted:     Color(hex: "#6b7280"),
        brand:     Color(hex: "#6366f1"),
        brand2:    Color(hex: "#4f46e5"),
        brandLt:   Color(hex: "#4338ca"),
        forgotPw:  Color(hex: "#4f46e5"),
        fbBlue:    Color(hex: "#1877F2"),
        lineGrn:   Color(hex: "#06C755"),
        glow1:     Color(hex: "#6366f1"),
        glow2:     Color(hex: "#7c3aed"),
        gradientTop:    Color(hex: "#eef2ff"),
        gradientBottom: Color(hex: "#ffffff")
    )
}

struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @ObservedObject private var settings = AppSettings.shared
    @Environment(\.colorScheme) private var systemScheme

    /// Resolves the active palette from the user's chosen display mode
    /// (falls back to the system scheme when the mode is "system") — this is
    /// what makes the top-right theme pill actually change the look of the
    /// login screen, mirroring the web's adaptive light/dark login page.
    private var c: LoginPalette {
        let resolved = settings.displayMode.colorScheme ?? systemScheme
        return resolved == .dark ? .dark : .light
    }

    @State private var email     = ""
    @State private var password  = ""
    @State private var showPw    = false
    @State private var remember  = true
    @State private var isLoading = false
    @State private var oauthKey: String? = nil
    @State private var localError: String?

    var body: some View {
        ZStack {
            // ── Dark gradient bg (matches web #070a18 → #0f1235) ──────
            LinearGradient(
                colors: [c.gradientTop, c.gradientBottom],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            // Glow blobs
            Circle().fill(c.glow1.opacity(0.13))
                .frame(width: 360).blur(radius: 90)
                .offset(x: -110, y: -280)
            Circle().fill(c.glow2.opacity(0.08))
                .frame(width: 300).blur(radius: 90)
                .offset(x: 150, y: 150)

            VStack(spacing: 0) {
                // ── Top bar (logo + theme) ────────────────────────────
                topBar

                // ── Scrollable content ────────────────────────────────
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        Spacer().frame(height: 32)

                        // Heading
                        VStack(alignment: .leading, spacing: 6) {
                            Text("ยินดีต้อนรับกลับ")
                                .font(.system(size: 30, weight: .bold))
                                .foregroundColor(c.text)
                            Text("เข้าสู่บัญชี Slippy ของคุณ")
                                .font(.system(size: 14))
                                .foregroundColor(c.muted)
                        }
                        .padding(.horizontal, 24)

                        Spacer().frame(height: 28)

                        // ── Social ────────────────────────────────────
                        VStack(spacing: 10) {
                            googleButton
                            HStack(spacing: 10) {
                                facebookButton
                                lineButton
                            }
                        }
                        .padding(.horizontal, 24)
                        .disabled(oauthKey != nil || isLoading)

                        // ── Divider ───────────────────────────────────
                        divider.padding(.vertical, 20)

                        // ── Form ──────────────────────────────────────
                        VStack(spacing: 16) {
                            if let err = localError ?? authVM.error {
                                errorBanner(err)
                            }
                            emailField
                            passwordField
                            rememberRow
                            submitButton
                        }
                        .padding(.horizontal, 24)

                        // Register link
                        HStack(spacing: 4) {
                            Text("ยังไม่มีบัญชี?")
                                .font(.system(size: 13)).foregroundColor(c.muted)
                            Button("สมัครสมาชิก") {}
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(c.forgotPw)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 20)

                        // Demo account
                        demoSection
                            .padding(.horizontal, 24)
                            .padding(.top, 16)

                        Spacer().frame(height: 52)
                    }
                }
            }
        }
        .onTapGesture { hideKeyboard() }
    }

    // MARK: – Top bar
    private var topBar: some View {
        HStack {
            // Logo
            HStack(spacing: 10) {
                SlippyLogoMark(size: 36)
                Text("Slippy")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(c.text)
            }
            Spacer()
            // Theme pill toggle
            ThemePicker()
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 8)
    }

    // MARK: – Google button
    private var googleButton: some View {
        Button { Task { await runOAuth("Google", provider: .google) } } label: {
            HStack(spacing: 10) {
                if oauthKey == "Google" {
                    ProgressView().tint(c.muted).scaleEffect(0.9)
                } else {
                    GoogleLogo(size: 20)
                    Text("เข้าสู่ระบบด้วย Google")
                        .font(.system(size: 14.5, weight: .medium))
                        .foregroundColor(c.text)
                }
            }
            .frame(maxWidth: .infinity).frame(height: 46)
            .background(c.card)
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(c.border, lineWidth: 1))
        }
    }

    // MARK: – Facebook button
    private var facebookButton: some View {
        Button { Task { await runOAuth("Facebook", provider: .facebook) } } label: {
            ZStack {
                if oauthKey == "Facebook" {
                    ProgressView().tint(c.muted).scaleEffect(0.85)
                } else {
                    HStack(spacing: 8) {
                        FacebookLogo(size: 20)
                        Text("Facebook")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(c.text)
                    }
                }
            }
            .frame(maxWidth: .infinity).frame(height: 46)
            .background(c.card)
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(c.border, lineWidth: 1))
        }
    }

    // MARK: – LINE button
    private var lineButton: some View {
        Button {
            Task { await runLineOAuth() }
        } label: {
            ZStack {
                if oauthKey == "LINE" {
                    ProgressView().tint(c.muted).scaleEffect(0.85)
                } else {
                    HStack(spacing: 8) {
                        LineLogo(size: 20)
                        Text("LINE")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(c.text)
                    }
                }
            }
            .frame(maxWidth: .infinity).frame(height: 46)
            .background(c.card)
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(c.border, lineWidth: 1))
        }
    }

    // MARK: – Divider
    private var divider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(c.border).frame(height: 1)
            Text("หรือใช้อีเมล")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(c.muted).fixedSize()
            Rectangle().fill(c.border).frame(height: 1)
        }
        .padding(.horizontal, 24)
    }

    // MARK: – Error banner
    private func errorBanner(_ msg: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(Color(hex: "#f87171")).font(.system(size: 13))
            Text(msg).font(.system(size: 13)).foregroundColor(Color(hex: "#f87171"))
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: "#7f1d1d").opacity(0.4))
        .cornerRadius(10)
        .overlay(RoundedRectangle(cornerRadius: 10)
            .stroke(Color(hex: "#dc2626").opacity(0.45), lineWidth: 1))
    }

    // MARK: – Email field
    private var emailField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("อีเมล")
                .font(.system(size: 13, weight: .medium)).foregroundColor(c.text)
            HStack(spacing: 10) {
                Image(systemName: "envelope")
                    .foregroundColor(c.muted).font(.system(size: 15))
                TextField("", text: $email,
                          prompt: Text("you@company.com").foregroundColor(c.muted))
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()
                    .foregroundColor(c.text)
                    .font(.system(size: 14))
            }
            .padding(.horizontal, 13).padding(.vertical, 13)
            .background(c.inputBg).cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(c.border, lineWidth: 1))
        }
    }

    // MARK: – Password field
    private var passwordField: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("รหัสผ่าน")
                    .font(.system(size: 13, weight: .medium)).foregroundColor(c.text)
                Spacer()
                Button("ลืมรหัสผ่าน?") {}
                    .font(.system(size: 12, weight: .medium)).foregroundColor(c.forgotPw)
            }
            HStack(spacing: 10) {
                Image(systemName: "lock.shield")
                    .foregroundColor(c.muted).font(.system(size: 15))
                Group {
                    if showPw {
                        TextField("", text: $password,
                                  prompt: Text("••••••••").foregroundColor(c.muted))
                    } else {
                        SecureField("", text: $password,
                                    prompt: Text("••••••••").foregroundColor(c.muted))
                    }
                }
                .foregroundColor(c.text).font(.system(size: 14))
                Button { showPw.toggle() } label: {
                    Image(systemName: showPw ? "eye.slash" : "eye")
                        .foregroundColor(c.muted).font(.system(size: 15))
                }
            }
            .padding(.horizontal, 13).padding(.vertical, 13)
            .background(c.inputBg).cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(c.border, lineWidth: 1))
        }
    }

    // MARK: – Remember me checkbox
    private var rememberRow: some View {
        HStack(spacing: 9) {
            Button { remember.toggle() } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(remember ? c.brand : Color.clear)
                        .frame(width: 17, height: 17)
                        .overlay(RoundedRectangle(cornerRadius: 4)
                            .stroke(remember ? c.brand : c.muted, lineWidth: 1.5))
                    if remember {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold)).foregroundColor(.white)
                    }
                }
            }
            Text("จดจำการเข้าสู่ระบบบนเครื่องนี้")
                .font(.system(size: 13)).foregroundColor(c.muted)
        }
    }

    // MARK: – Submit button
    private var submitButton: some View {
        Button { Task { await handleEmailSignIn() } } label: {
            HStack(spacing: 8) {
                if isLoading { ProgressView().tint(.white).scaleEffect(0.9) }
                Text("เข้าสู่ระบบ")
                    .font(.system(size: 15, weight: .semibold))
            }
            .frame(maxWidth: .infinity).frame(height: 46)
            .background(
                LinearGradient(colors: [c.brand, c.brand2],
                               startPoint: .leading, endPoint: .trailing)
            )
            .foregroundColor(.white).cornerRadius(10)
            .opacity((isLoading || oauthKey != nil) ? 0.6 : 1)
        }
        .disabled(isLoading || oauthKey != nil)
    }

    // MARK: – Demo section
    private var demoSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle")
                    .foregroundColor(c.brand).font(.system(size: 14)).padding(.top, 1)
                (Text("Demo Account").font(.system(size: 12.5, weight: .bold)).foregroundColor(c.text)
                 + Text(" — สำหรับทดลองใช้งานระบบโดยไม่ต้องสมัคร")
                    .font(.system(size: 12.5)).foregroundColor(c.muted))
            }
            Button {
                email    = "demo@slippy.app"
                password = "password"
            } label: {
                Text("เข้าสู่ระบบด้วย Demo Account")
                    .font(.system(size: 13, weight: .medium)).foregroundColor(c.brandLt)
                    .frame(maxWidth: .infinity).frame(height: 36)
                    .background(c.demoBg).cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8)
                        .stroke(c.demoBorder.opacity(0.9), lineWidth: 1))
            }
        }
        .padding(14)
        .background(c.card).cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(c.border, lineWidth: 1))
    }

    // MARK: – Actions
    private func handleEmailSignIn() async {
        guard !email.isEmpty, !password.isEmpty else {
            localError = "กรุณากรอกอีเมลและรหัสผ่าน"; return
        }
        localError = nil; isLoading = true
        await authVM.signIn(email: email, password: password)
        if let err = authVM.error {
            localError = err.contains("Invalid login credentials")
                ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
                : err.contains("Email not confirmed")
                ? "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"
                : err
            authVM.error = nil
        }
        isLoading = false
    }

    private func runOAuth(_ key: String, provider: Provider) async {
        oauthKey = key; localError = nil; authVM.error = nil
        await authVM.signInWithOAuth(provider: provider)
        if let err = authVM.error { localError = err; authVM.error = nil }
        oauthKey = nil
    }

    /// LINE has no native Supabase provider — routed through the web's custom
    /// `/api/auth/line` flow (see `AuthViewModel.signInWithLine`).
    private func runLineOAuth() async {
        oauthKey = "LINE"; localError = nil; authVM.error = nil
        await authVM.signInWithLine()
        if let err = authVM.error { localError = err; authVM.error = nil }
        oauthKey = nil
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

// MARK: – Preview
#if DEBUG
#Preview("Login – normal") {
    LoginView().environmentObject({ () -> AuthViewModel in
        let vm = AuthViewModel(_preview: true)
        vm.isLoading = false; return vm
    }())
}

#Preview("Login – error") {
    LoginView().environmentObject({ () -> AuthViewModel in
        let vm = AuthViewModel(_preview: true)
        vm.isLoading = false
        vm.error = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
        return vm
    }())
}
#endif
