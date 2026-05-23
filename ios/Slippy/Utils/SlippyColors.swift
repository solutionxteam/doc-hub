import SwiftUI

extension Color {
    // MARK: – Brand (Indigo)
    static let brand50  = Color(hex: "#eef2ff")
    static let brand100 = Color(hex: "#e0e7ff")
    static let brand400 = Color(hex: "#818cf8")
    static let brand500 = Color(hex: "#6366f1")
    static let brand600 = Color(hex: "#4f46e5")
    static let brand700 = Color(hex: "#4338ca")
    static let brand900 = Color(hex: "#312e81")

    // MARK: – Status
    static let statusPending    = Color(hex: "#94a3b8")
    static let statusProcessing = Color(hex: "#3b82f6")
    static let statusReviewing  = Color(hex: "#f59e0b")
    static let statusApproved   = Color(hex: "#10b981")
    static let statusPushed     = Color(hex: "#8b5cf6")
    static let statusFailed     = Color(hex: "#ef4444")

    // MARK: – Surface
    static let surface      = Color(hex: "#ffffff")
    static let surfaceMuted = Color(hex: "#f4f4f6")
    static let border       = Color(hex: "#e5e7eb")
    static let textPrimary  = Color(hex: "#111827")
    static let textSecondary = Color(hex: "#6b7280")

    // MARK: – Hex initialiser
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:  (a,r,g,b) = (255,(int>>8)*17,(int>>4 & 0xF)*17,(int & 0xF)*17)
        case 6:  (a,r,g,b) = (255, int>>16, int>>8 & 0xFF, int & 0xFF)
        case 8:  (a,r,g,b) = (int>>24, int>>16 & 0xFF, int>>8 & 0xFF, int & 0xFF)
        default: (a,r,g,b) = (255,0,0,0)
        }
        self.init(.sRGB,
                  red:   Double(r)/255,
                  green: Double(g)/255,
                  blue:  Double(b)/255,
                  opacity: Double(a)/255)
    }
}

func statusColor(for status: String) -> Color {
    switch status {
    case "pushed":    return .statusPushed
    case "approved":  return .statusApproved
    case "reviewing": return .statusReviewing
    case "processing":return .statusProcessing
    case "failed":    return .statusFailed
    default:          return .statusPending
    }
}
