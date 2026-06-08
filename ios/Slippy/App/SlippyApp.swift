import SwiftUI

@main
struct SlippyApp: App {
    @StateObject private var authVM   = AuthViewModel()
    @ObservedObject private var settings = AppSettings.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authVM)
                .preferredColorScheme(settings.displayMode.colorScheme)
        }
    }
}
