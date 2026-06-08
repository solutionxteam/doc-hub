import SwiftUI
import Combine

/// Manages app-wide display mode (light / system / dark)
/// Persisted in UserDefaults so preference survives restarts.
final class AppSettings: ObservableObject {

    enum DisplayMode: String, CaseIterable {
        case light  = "light"
        case system = "system"
        case dark   = "dark"

        /// SF Symbol matching the web's outline icon set (sun / monitor / moon)
        var symbol: String {
            switch self {
            case .light:  return "sun.max"
            case .system: return "display"
            case .dark:   return "moon.fill"
            }
        }

        var colorScheme: ColorScheme? {
            switch self {
            case .light:  return .light
            case .dark:   return .dark
            case .system: return nil
            }
        }
    }

    static let shared = AppSettings()

    @Published var displayMode: DisplayMode {
        didSet { UserDefaults.standard.set(displayMode.rawValue, forKey: "displayMode") }
    }

    private init() {
        let saved = UserDefaults.standard.string(forKey: "displayMode") ?? "system"
        displayMode = DisplayMode(rawValue: saved) ?? .system
    }
}

/// Segmented pill toggle — outline SF Symbols (sun / monitor / moon),
/// pixel-styled to match the web's display-mode switch:
/// selected segment gets a dark rounded chip with a solid white icon,
/// unselected segments show muted outline icons on transparent background.
struct ThemePicker: View {
    @ObservedObject var settings = AppSettings.shared

    private let trackBg     = Color(hex: "#0b0d18")
    private let chipBg      = Color(hex: "#000000").opacity(0.55)
    private let mutedIcon   = Color(hex: "#9ca3af")

    var body: some View {
        HStack(spacing: 2) {
            ForEach(AppSettings.DisplayMode.allCases, id: \.self) { mode in
                let selected = settings.displayMode == mode
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) {
                        settings.displayMode = mode
                    }
                } label: {
                    Image(systemName: mode.symbol)
                        .font(.system(size: 13, weight: selected ? .semibold : .regular))
                        .foregroundColor(selected ? .white : mutedIcon)
                        .frame(width: 34, height: 30)
                        .background(
                            selected
                                ? RoundedRectangle(cornerRadius: 8).fill(chipBg)
                                : RoundedRectangle(cornerRadius: 8).fill(Color.clear)
                        )
                }
            }
        }
        .padding(3)
        .background(trackBg)
        .clipShape(RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11)
            .stroke(Color.white.opacity(0.08), lineWidth: 1))
    }
}

#if DEBUG
#Preview {
    ZStack {
        Color(hex: "#070a18").ignoresSafeArea()
        ThemePicker()
    }
}
#endif
