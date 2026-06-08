import SwiftUI

/// Slippy brand logo mark — SwiftUI re-creation of `logo-mark.svg`
/// (rounded gradient blob + friendly "slip" ghost character).
/// Renders crisply at any size via Canvas + scaled path coordinates (viewBox 48×48).
struct SlippyLogoMark: View {
    var size: CGFloat = 48
    /// When true, adds a soft brand-coloured glow behind the mark (used on splash/auth screens)
    var glow: Bool = false

    var body: some View {
        ZStack {
            if glow {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color(hex: "#6366f1").opacity(0.45), .clear],
                            center: .center, startRadius: 0, endRadius: size * 0.9
                        )
                    )
                    .frame(width: size * 1.8, height: size * 1.8)
                    .blur(radius: size * 0.18)
            }

            Canvas { ctx, canvasSize in
                let s = canvasSize.width / 48.0
                func P(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }

                // ── 1. Rounded-square blob with diagonal gradient ──────
                var blob = Path()
                blob.move(to: P(24, 2))
                blob.addCurve(to: P(2, 24),  control1: P(9.5, 2),  control2: P(2, 9.5))
                blob.addCurve(to: P(24, 46), control1: P(2, 38.5), control2: P(9.5, 46))
                blob.addCurve(to: P(46, 24), control1: P(38.5, 46), control2: P(46, 38.5))
                blob.addCurve(to: P(24, 2),  control1: P(46, 9.5),  control2: P(38.5, 2))
                blob.closeSubpath()

                ctx.fill(blob, with: .linearGradient(
                    Gradient(stops: [
                        .init(color: Color(hex: "#8b5cf6"), location: 0),
                        .init(color: Color(hex: "#6366f1"), location: 0.5),
                        .init(color: Color(hex: "#ec4899"), location: 1),
                    ]),
                    startPoint: P(2, 2), endPoint: P(46, 46)
                ))

                // Soft top-left highlight overlay
                ctx.fill(blob, with: .radialGradient(
                    Gradient(stops: [
                        .init(color: .white.opacity(0.5), location: 0),
                        .init(color: .white.opacity(0.05), location: 0.5),
                        .init(color: .white.opacity(0), location: 1),
                    ]),
                    center: P(48 * 0.2, 48 * 0.15),
                    startRadius: 0, endRadius: 48 * 0.85 * s
                ))

                // ── 2. "Slip" ghost character (rotated -7°) ────────────
                ctx.drawLayer { layer in
                    layer.translateBy(x: P(24, 24).x, y: P(24, 24).y)
                    layer.rotate(by: .degrees(-7))
                    layer.translateBy(x: -P(24, 24).x, y: -P(24, 24).y)

                    // soft drop shadow body
                    var shadowBody = Path()
                    buildGhostBody(&shadowBody, P: { x, y in P(x + 0.6, y + 0.9) })
                    layer.fill(shadowBody, with: .color(Color(hex: "#1e1b4b").opacity(0.18)))

                    // main body — white/slate gradient
                    var body = Path()
                    buildGhostBody(&body, P: P)
                    layer.fill(body, with: .linearGradient(
                        Gradient(stops: [
                            .init(color: .white, location: 0),
                            .init(color: Color(hex: "#f1f5f9"), location: 1),
                        ]),
                        startPoint: P(14, 13), endPoint: P(34, 33)
                    ))

                    // eyes
                    let eyeColor = GraphicsContext.Shading.color(Color(hex: "#1e1b4b"))
                    layer.fill(Circle().path(in: CGRect(x: P(20.2, 20.2).x - 1.45*s, y: P(20.2, 20.2).y - 1.45*s, width: 2.9*s, height: 2.9*s)), with: eyeColor)
                    layer.fill(Circle().path(in: CGRect(x: P(27.8, 20.2).x - 1.45*s, y: P(27.8, 20.2).y - 1.45*s, width: 2.9*s, height: 2.9*s)), with: eyeColor)

                    // blush cheeks
                    let blush = GraphicsContext.Shading.color(Color(hex: "#fb7185").opacity(0.55))
                    layer.fill(Circle().path(in: CGRect(x: P(18.4, 24.2).x - 1.2*s, y: P(18.4, 24.2).y - 1.2*s, width: 2.4*s, height: 2.4*s)), with: blush)
                    layer.fill(Circle().path(in: CGRect(x: P(29.6, 24.2).x - 1.2*s, y: P(29.6, 24.2).y - 1.2*s, width: 2.4*s, height: 2.4*s)), with: blush)

                    // smile
                    var smile = Path()
                    smile.move(to: P(20, 24.5))
                    smile.addQuadCurve(to: P(28, 24.5), control: P(24, 28))
                    layer.stroke(smile, with: .color(Color(hex: "#1e1b4b")),
                                 style: StrokeStyle(lineWidth: 1.7 * s, lineCap: .round))
                }
            }
            .frame(width: size, height: size)
        }
    }

    /// Builds the rounded "ghost/slip-sheet" body path (scallop bottom edge).
    private func buildGhostBody(_ path: inout Path, P: (CGFloat, CGFloat) -> CGPoint) {
        path.move(to: P(16.5, 12.5))
        path.addLine(to: P(31.5, 12.5))
        path.addQuadCurve(to: P(34, 15), control: P(34, 12.5))
        path.addLine(to: P(34, 30))
        path.addLine(to: P(31.7, 32.6))
        path.addLine(to: P(29.5, 30))
        path.addLine(to: P(27.2, 32.6))
        path.addLine(to: P(25, 30))
        path.addLine(to: P(22.8, 32.6))
        path.addLine(to: P(20.5, 30))
        path.addLine(to: P(18.3, 32.6))
        path.addLine(to: P(16, 30))
        path.addLine(to: P(14, 32.6))
        path.addLine(to: P(14, 15))
        path.addQuadCurve(to: P(16.5, 12.5), control: P(14, 12.5))
        path.closeSubpath()
    }
}

#if DEBUG
#Preview {
    ZStack {
        LinearGradient(colors: [Color(hex: "#070a18"), Color(hex: "#0f1235")],
                       startPoint: .top, endPoint: .bottom).ignoresSafeArea()
        VStack(spacing: 24) {
            SlippyLogoMark(size: 96, glow: true)
            HStack(spacing: 20) {
                SlippyLogoMark(size: 28)
                SlippyLogoMark(size: 40)
                SlippyLogoMark(size: 64)
            }
        }
    }
}
#endif
