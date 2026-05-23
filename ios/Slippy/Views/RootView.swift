import SwiftUI

struct RootView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        Group {
            if authVM.isLoading {
                SplashView()
            } else if authVM.isSignedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authVM.isSignedIn)
    }
}

// MARK: – Splash / Launch Screen
private struct SplashView: View {
    @State private var scale = 0.7
    @State private var opacity = 0.0

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "#070a18"), Color(hex: "#0f1235")],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color.brand500.opacity(0.15))
                        .frame(width: 100, height: 100)
                        .blur(radius: 20)
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 44, weight: .light))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [Color.brand400, .purple],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            )
                        )
                }
                Text("Slippy")
                    .font(.system(size: 32, weight: .black, design: .rounded))
                    .foregroundColor(.white)
            }
            .scaleEffect(scale)
            .opacity(opacity)
            .onAppear {
                withAnimation(.spring(duration: 0.6)) {
                    scale   = 1.0
                    opacity = 1.0
                }
            }
        }
    }
}
