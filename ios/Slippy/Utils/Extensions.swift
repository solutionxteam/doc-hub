import SwiftUI

// MARK: – View modifiers
extension View {
    func cardStyle() -> some View {
        self
            .background(Color.surface)
            .cornerRadius(16)
            .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 2)
    }

    func sectionCard() -> some View {
        self
            .padding(16)
            .background(Color.surface)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.border, lineWidth: 1)
            )
    }
}

// MARK: – StatusBadge
struct StatusBadge: View {
    let status: String
    var body: some View {
        Text(statusLabel(status))
            .font(.system(size: 11, weight: .700))
            .foregroundColor(statusColor(for: status))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(statusColor(for: status).opacity(0.12))
            .clipShape(Capsule())
    }
}

private func statusLabel(_ status: String) -> String {
    switch status {
    case "pushed":    return "ส่งแล้ว"
    case "approved":  return "อนุมัติ"
    case "reviewing": return "ตรวจสอบ"
    case "processing":return "ประมวลผล"
    case "failed":    return "ผิดพลาด"
    default:          return "รอดำเนินการ"
    }
}

// MARK: – Avatar with Initials
struct InitialsAvatar: View {
    let text: String
    var size: CGFloat = 44
    var color: Color  = .brand500

    var body: some View {
        ZStack {
            Circle().fill(color)
            Text(text)
                .font(.system(size: size * 0.35, weight: .800))
                .foregroundColor(.white)
        }
        .frame(width: size, height: size)
    }
}

// MARK: – Haptic feedback
func hapticLight()   { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
func hapticMedium()  { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
func hapticSuccess() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
