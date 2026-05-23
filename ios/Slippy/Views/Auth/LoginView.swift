import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var email    = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var localError: String?

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [Color(hex: "#070a18"), Color(hex: "#0f1235")],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            // Glow blobs
            Circle().fill(Color.brand500.opacity(0.15))
                .frame(width: 300, height: 300)
                .blur(radius: 60)
                .offset(x: -80, y: -200)
            Circle().fill(Color.purple.opacity(0.10))
                .frame(width: 250, height: 250)
                .blur(radius: 60)
                .offset(x: 120, y: 100)

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 80)

                    // Logo
                    VStack(spacing: 12) {
                        ZStack {
                            Circle().fill(Color.brand500.opacity(0.2))
                                .frame(width: 80, height: 80)
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.system(size: 36, weight: .light))
                                .foregroundStyle(
                                    LinearGradient(colors: [Color.brand400, .purple],
                                                   startPoint: .topLeading,
                                                   endPoint: .bottomTrailing)
                                )
                        }
                        Text("Slippy")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                        Text("ระบบจัดการเอกสารบัญชีอัจฉริยะ")
                            .font(.system(size: 14))
                            .foregroundColor(.white.opacity(0.55))
                    }

                    Spacer().frame(height: 48)

                    // Form card
                    VStack(spacing: 16) {
                        // Error
                        if let error = localError ?? authVM.error {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                Text(error)
                                    .font(.system(size: 13))
                                    .foregroundColor(Color(hex: "#ef4444"))
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(hex: "#fef2f2"))
                            .cornerRadius(10)
                        }

                        // Email field
                        VStack(alignment: .leading, spacing: 6) {
                            Text("อีเมล")
                                .font(.system(size: 13, weight: .600))
                                .foregroundColor(Color.textSecondary)
                            HStack {
                                Image(systemName: "envelope")
                                    .foregroundColor(Color.textSecondary)
                                TextField("demo@slippy.app", text: $email)
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .autocorrectionDisabled()
                            }
                            .padding(14)
                            .background(Color.surfaceMuted)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.border, lineWidth: 1)
                            )
                        }

                        // Password field
                        VStack(alignment: .leading, spacing: 6) {
                            Text("รหัสผ่าน")
                                .font(.system(size: 13, weight: .600))
                                .foregroundColor(Color.textSecondary)
                            HStack {
                                Image(systemName: "lock")
                                    .foregroundColor(Color.textSecondary)
                                SecureField("••••••••", text: $password)
                            }
                            .padding(14)
                            .background(Color.surfaceMuted)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.border, lineWidth: 1)
                            )
                        }

                        // Sign in button
                        Button {
                            Task { await handleSignIn() }
                        } label: {
                            HStack {
                                if isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Text("เข้าสู่ระบบ")
                                        .font(.system(size: 16, weight: .700))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                LinearGradient(
                                    colors: [Color.brand500, Color.brand600],
                                    startPoint: .leading, endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(14)
                        }
                        .disabled(isLoading)
                    }
                    .padding(24)
                    .background(Color.surface)
                    .cornerRadius(24)
                    .shadow(color: .black.opacity(0.1), radius: 24, x: 0, y: 8)
                    .padding(.horizontal, 24)

                    Spacer().frame(height: 40)
                }
            }
        }
    }

    private func handleSignIn() async {
        guard !email.isEmpty, !password.isEmpty else {
            localError = "กรุณากรอกอีเมลและรหัสผ่าน"
            return
        }
        localError = nil
        isLoading  = true
        await authVM.signIn(email: email, password: password)
        isLoading  = false
        if authVM.error != nil { hapticLight() }
        else { hapticSuccess() }
    }
}
