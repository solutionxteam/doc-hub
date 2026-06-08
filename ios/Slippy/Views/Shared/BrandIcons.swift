import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// Brand login icons — SwiftUI re-creations of the exact SVG paths used on the
// web (`web/src/components/auth/login-form.tsx` → SvgGoogle / SvgFacebook / SvgLine).
// All paths are defined in a 24×24 viewBox and scaled via Canvas.
// ─────────────────────────────────────────────────────────────────────────────

/// Google "G" mark — 4-colour logo, pixel-matched to web SvgGoogle viewBox 24×24
struct GoogleLogo: View {
    var size: CGFloat = 18
    var body: some View {
        Canvas { ctx, canvasSize in
            let s = canvasSize.width / 24.0
            func P(_ x: Double, _ y: Double) -> CGPoint { .init(x: x * s, y: y * s) }

            var blue = Path()
            blue.move(to: P(22.56, 12.25))
            blue.addCurve(to: P(22.36, 10), control1: P(22.56, 11.47), control2: P(22.49, 10.72))
            blue.addLine(to: P(12, 10))
            blue.addLine(to: P(12, 14.26))
            blue.addLine(to: P(17.92, 14.26))
            blue.addCurve(to: P(15.72, 17.58), control1: P(17.66, 15.63), control2: P(16.89, 16.79))
            blue.addLine(to: P(15.72, 20.35))
            blue.addCurve(to: P(22.56, 12.25), control1: P(19.86, 18.49), control2: P(22.56, 15.72))
            blue.closeSubpath()
            ctx.fill(blue, with: .color(Color(hex: "#4285F4")))

            var green = Path()
            green.move(to: P(12, 23))
            green.addCurve(to: P(19.28, 20.34), control1: P(14.97, 23), control2: P(17.46, 22.02))
            green.addLine(to: P(15.72, 17.57))
            green.addCurve(to: P(12, 18.62), control1: P(14.73, 18.23), control2: P(13.46, 18.62))
            green.addCurve(to: P(5.84, 14.09), control1: P(9.14, 18.62), control2: P(6.71, 16.68))
            green.addLine(to: P(2.18, 16.93))
            green.addCurve(to: P(12, 23), control1: P(3.66, 19.92), control2: P(6.71, 23))
            green.closeSubpath()
            ctx.fill(green, with: .color(Color(hex: "#34A853")))

            var yellow = Path()
            yellow.move(to: P(5.84, 14.09))
            yellow.addCurve(to: P(5.84, 9.91), control1: P(5.62, 13.43), control2: P(5.62, 10.57))
            yellow.addLine(to: P(2.18, 7.07))
            yellow.addCurve(to: P(2.18, 16.93), control1: P(0.86, 9.72), control2: P(0.86, 14.28))
            yellow.addLine(to: P(5.84, 14.09))
            yellow.closeSubpath()
            ctx.fill(yellow, with: .color(Color(hex: "#FBBC05")))

            var red = Path()
            red.move(to: P(12, 5.38))
            red.addCurve(to: P(16.21, 7.02), control1: P(13.62, 5.38), control2: P(15.06, 5.94))
            red.addLine(to: P(19.36, 3.87))
            red.addCurve(to: P(12, 1), control1: P(17.45, 2.09), control2: P(14.97, 1))
            red.addCurve(to: P(2.18, 7.07), control1: P(7.7, 1), control2: P(3.99, 3.47))
            red.addLine(to: P(5.84, 9.91))
            red.addCurve(to: P(12, 5.38), control1: P(6.71, 7.32), control2: P(9.14, 5.38))
            red.closeSubpath()
            ctx.fill(red, with: .color(Color(hex: "#EA4335")))
        }
        .frame(width: size, height: size)
    }
}

/// Facebook "f" — full circular brand mark, pixel-matched to web SvgFacebook
struct FacebookLogo: View {
    var size: CGFloat = 18
    var body: some View {
        Canvas { ctx, canvasSize in
            let s = canvasSize.width / 24.0
            func P(_ x: Double, _ y: Double) -> CGPoint { .init(x: x * s, y: y * s) }

            var p = Path()
            p.move(to: P(24, 12))
            p.addCurve(to: P(10.125, 23.855), control1: P(24, 5.37), control2: P(18.9, 0))
            // approximate remainder of circular brand badge with the lowercase "f" cut-out
            p.addLine(to: P(10.125, 15.47))
            p.addLine(to: P(7.078, 15.47))
            p.addLine(to: P(7.078, 12))
            p.addLine(to: P(10.125, 12))
            p.addLine(to: P(10.125, 9.36))
            p.addCurve(to: P(14.658, 4.691), control1: P(10.125, 6.354), control2: P(11.916, 4.691))
            p.addCurve(to: P(17.344, 4.925), control1: P(15.97, 4.691), control2: P(17.344, 4.925))
            p.addLine(to: P(17.344, 7.878))
            p.addLine(to: P(15.83, 7.878))
            p.addCurve(to: P(13.874, 9.752), control1: P(14.339, 7.878), control2: P(13.874, 8.803))
            p.addLine(to: P(13.874, 12))
            p.addLine(to: P(17.202, 12))
            p.addLine(to: P(16.67, 15.47))
            p.addLine(to: P(13.874, 15.47))
            p.addLine(to: P(13.874, 23.855))
            p.addCurve(to: P(24, 12), control1: P(20.337, 22.815), control2: P(24, 17.843))
            p.closeSubpath()
            ctx.fill(p, with: .color(Color(hex: "#1877F2")))
        }
        .frame(width: size, height: size)
    }
}

/// LINE speech-bubble mark — pixel-matched to web SvgLine (rounded square + "LINE" glyphs)
struct LineLogo: View {
    var size: CGFloat = 18
    var body: some View {
        Canvas { ctx, canvasSize in
            let s = canvasSize.width / 24.0
            func P(_ x: Double, _ y: Double) -> CGPoint { .init(x: x * s, y: y * s) }

            // Rounded chat-bubble badge
            let badge = RoundedRectangle(cornerRadius: 7 * s)
                .path(in: CGRect(x: 0, y: 0, width: 24 * s, height: 21 * s))
            ctx.fill(badge, with: .color(Color(hex: "#06C755")))

            // tail
            var tail = Path()
            tail.move(to: P(7, 20.5))
            tail.addLine(to: P(7, 23.6))
            tail.addLine(to: P(11, 20.5))
            tail.closeSubpath()
            ctx.fill(tail, with: .color(Color(hex: "#06C755")))

            // "L I N E" simplified glyph bars — white
            let barColor = GraphicsContext.Shading.color(.white)
            // L
            ctx.fill(RoundedRectangle(cornerRadius: 0.6*s).path(in: CGRect(x: 4*s, y: 7*s, width: 1.6*s, height: 7*s)), with: barColor)
            ctx.fill(RoundedRectangle(cornerRadius: 0.6*s).path(in: CGRect(x: 4*s, y: 12.4*s, width: 3.6*s, height: 1.6*s)), with: barColor)
            // I
            ctx.fill(RoundedRectangle(cornerRadius: 0.6*s).path(in: CGRect(x: 9.4*s, y: 7*s, width: 1.6*s, height: 7*s)), with: barColor)
            // N (two verticals + diagonal)
            ctx.fill(RoundedRectangle(cornerRadius: 0.6*s).path(in: CGRect(x: 12.6*s, y: 7*s, width: 1.5*s, height: 7*s)), with: barColor)
            ctx.fill(RoundedRectangle(cornerRadius: 0.6*s).path(in: CGRect(x: 17.4*s, y: 7*s, width: 1.5*s, height: 7*s)), with: barColor)
            var diag = Path()
            diag.move(to: P(13.6, 7.4))
            diag.addLine(to: P(17.9, 13.6))
            ctx.stroke(diag, with: barColor, style: StrokeStyle(lineWidth: 1.5*s, lineCap: .round))
            // E
            ctx.fill(RoundedRectangle(cornerRadius: 0.6*s).path(in: CGRect(x: 20.4*s, y: 7*s, width: 1.5*s, height: 1.5*s)), with: barColor)
        }
        .frame(width: size, height: size * 21 / 24)
    }
}

#if DEBUG
#Preview {
    ZStack {
        Color(hex: "#070a18").ignoresSafeArea()
        VStack(spacing: 28) {
            HStack(spacing: 24) {
                GoogleLogo(size: 32)
                FacebookLogo(size: 32)
                LineLogo(size: 32)
            }
            HStack(spacing: 24) {
                GoogleLogo(size: 20)
                FacebookLogo(size: 20)
                LineLogo(size: 20)
            }
        }
        .padding(28)
        .background(Color(hex: "#111827"))
        .cornerRadius(16)
    }
}
#endif
