import SwiftUI
import VisionKit
import PDFKit
import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit

// ─────────────────────────────────────────────────────────────────────────────
// MARK: – Document Scanner (VisionKit)
//
// Replaces the old plain `UIImagePickerController` camera with Apple's native
// document scanner. This gives us, for free and at full hardware performance:
//   • Automatic edge / corner detection
//   • Automatic perspective ("keystone") correction & cropping
//   • Multi-page capture in one session
//   • Capture at the sensor's full resolution, optimised for flat documents
// All of which directly improves OCR/AI extraction accuracy downstream.
// ─────────────────────────────────────────────────────────────────────────────
struct DocumentScannerView: UIViewControllerRepresentable {
    /// Called with every page captured in the session, in order, once the
    /// user taps "Save". Empty array means the user cancelled.
    var onFinish: ([UIImage]) -> Void

    /// `VNDocumentCameraViewController.isSupported` reports `true` even on the
    /// Mac Simulator (Apple's API doesn't probe for a physical camera) — but
    /// actually presenting the scanner there fails at runtime with an
    /// "Unable to capture media" alert, since there's no camera hardware to
    /// back the capture session. Gate on the build target as well so the
    /// Simulator always falls through to the sample-document QA flow instead
    /// of showing a broken scanner sheet.
    static var isSupported: Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        return VNDocumentCameraViewController.isSupported
        #endif
    }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let vc = VNDocumentCameraViewController()
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let parent: DocumentScannerView
        init(_ parent: DocumentScannerView) { self.parent = parent }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                           didFinishWith scan: VNDocumentCameraScan) {
            var pages: [UIImage] = []
            pages.reserveCapacity(scan.pageCount)
            for i in 0..<scan.pageCount {
                // `imageOfPage` already returns the perspective-corrected,
                // cropped capture at full sensor resolution.
                pages.append(scan.imageOfPage(at: i))
            }
            hapticSuccess()
            controller.dismiss(animated: true) {
                self.parent.onFinish(pages)
            }
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            controller.dismiss(animated: true) {
                self.parent.onFinish([])
            }
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                           didFailWithError error: Error) {
            print("[DocumentScanner] error:", error.localizedDescription)
            controller.dismiss(animated: true) {
                self.parent.onFinish([])
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: – OCR Image Enhancer
//
// A lightweight CoreImage pipeline tuned for scanned documents/receipts:
//   1. Boost contrast & slightly reduce brightness/saturation so faint
//      thermal-printer text becomes crisper for OCR
//   2. Sharpen luminance to recover edge detail lost in JPEG/sensor noise
//   3. Re-render at native scale into a clean, orientation-corrected UIImage
//
// Runs on a background queue via `Task.detached` so the UI never stutters
// even with multi-page scans.
// ─────────────────────────────────────────────────────────────────────────────
enum DocumentEnhancer {
    private static let context = CIContext(options: [.useSoftwareRenderer: false])

    static func enhance(_ image: UIImage) -> UIImage {
        guard let cg = image.cgImage else { return image }
        var ciImage = CIImage(cgImage: cg)

        // 1) Contrast / brightness tuned for printed documents & receipts
        let colorControls = CIFilter.colorControls()
        colorControls.inputImage = ciImage
        colorControls.contrast   = 1.12
        colorControls.brightness = 0.02
        colorControls.saturation = 1.0
        if let out = colorControls.outputImage { ciImage = out }

        // 2) Luminance sharpening — recovers fine text edges for OCR
        let sharpen = CIFilter.sharpenLuminance()
        sharpen.inputImage = ciImage
        sharpen.sharpness  = 0.55
        sharpen.radius     = 1.6
        if let out = sharpen.outputImage { ciImage = out }

        // 3) Mild noise reduction to avoid amplifying sensor grain after sharpening
        let noiseReduction = CIFilter.noiseReduction()
        noiseReduction.inputImage   = ciImage
        noiseReduction.noiseLevel   = 0.012
        noiseReduction.sharpness    = 0.4
        if let out = noiseReduction.outputImage { ciImage = out }

        guard let outCG = context.createCGImage(ciImage, from: ciImage.extent) else { return image }
        return UIImage(cgImage: outCG, scale: image.scale, orientation: .up)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: – PDF Renderer
//
// Rasterises every page of an imported PDF at high DPI so text stays crisp
// once it goes through the same enhancement pipeline as camera scans.
// `scale: 2.0` ≈ 144dpi which is comfortably above the ~120dpi threshold most
// OCR engines need for reliable small-font recognition.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// MARK: – Sample Document Generator (Simulator testing aid)
//
// `VNDocumentCameraViewController.isSupported` is `false` on the Mac
// Simulator (no physical camera), so the scanner sheet would just present a
// black screen. Rather than block testing of the capture → enhance → upload
// pipeline on the Simulator, we synthesise a clean "receipt-like" document
// image on demand that flows through exactly the same code path as a real
// scan — keeping Simulator-based QA fully representative of on-device
// behaviour for everything downstream of the capture step.
// ─────────────────────────────────────────────────────────────────────────────
enum SampleDocumentGenerator {
    static func makeReceipt() -> UIImage {
        let size = CGSize(width: 1240, height: 1754) // ~A4 @150dpi portrait
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let cg = ctx.cgContext
            UIColor.white.setFill()
            cg.fill(CGRect(origin: .zero, size: size))

            let margin: CGFloat = 90
            var y: CGFloat = 110

            func draw(_ text: String, size fontSize: CGFloat, weight: UIFont.Weight = .regular,
                      color: UIColor = .black, align: NSTextAlignment = .left, gap: CGFloat = 14) {
                let para = NSMutableParagraphStyle()
                para.alignment = align
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: fontSize, weight: weight),
                    .foregroundColor: color,
                    .paragraphStyle: para
                ]
                let rect = CGRect(x: margin, y: y, width: size.width - margin * 2, height: fontSize * 1.6)
                (text as NSString).draw(in: rect, withAttributes: attrs)
                y += fontSize * 1.6 + gap
            }

            draw("ใบเสร็จรับเงิน / RECEIPT", size: 40, weight: .bold, align: .center, gap: 28)
            draw("บริษัท Demo จำกัด (สำนักงานใหญ่)", size: 24, align: .center)
            draw("เลขประจำตัวผู้เสียภาษี 0-1055-58009-xx-x", size: 18, color: .darkGray, align: .center, gap: 36)

            cg.setStrokeColor(UIColor.lightGray.cgColor)
            cg.setLineWidth(2)
            cg.move(to: CGPoint(x: margin, y: y))
            cg.addLine(to: CGPoint(x: size.width - margin, y: y))
            cg.strokePath()
            y += 32

            draw("เลขที่ใบเสร็จ: SIM-2026-0607",  size: 20)
            draw("วันที่: 7 มิถุนายน 2569",        size: 20, gap: 32)

            let items: [(String, String)] = [
                ("ค่าบริการที่ปรึกษาบัญชี",  "3,500.00"),
                ("ค่าซอฟต์แวร์รายเดือน",     "990.00"),
                ("ค่าธรรมเนียมธนาคาร",      "35.00")
            ]
            for (name, price) in items {
                let para = NSMutableParagraphStyle(); para.alignment = .left
                (name as NSString).draw(
                    in: CGRect(x: margin, y: y, width: size.width * 0.6, height: 32),
                    withAttributes: [.font: UIFont.systemFont(ofSize: 20), .paragraphStyle: para])
                let paraR = NSMutableParagraphStyle(); paraR.alignment = .right
                (("฿" + price) as NSString).draw(
                    in: CGRect(x: size.width * 0.55, y: y, width: size.width * 0.45 - margin, height: 32),
                    withAttributes: [.font: UIFont.systemFont(ofSize: 20, weight: .medium), .paragraphStyle: paraR])
                y += 44
            }

            y += 16
            cg.move(to: CGPoint(x: margin, y: y))
            cg.addLine(to: CGPoint(x: size.width - margin, y: y))
            cg.strokePath()
            y += 32

            draw("รวมทั้งสิ้น: ฿4,525.00", size: 26, weight: .bold, align: .right, gap: 60)
            draw("— เอกสารตัวอย่างที่สร้างขึ้นสำหรับทดสอบบน Simulator —",
                 size: 15, color: .gray, align: .center)
        }
    }
}

enum PDFRenderer {
    static func renderPages(at url: URL, scale: CGFloat = 2.0) -> [UIImage] {
        guard let document = PDFDocument(url: url) else { return [] }
        var images: [UIImage] = []
        images.reserveCapacity(document.pageCount)

        for i in 0..<document.pageCount {
            guard let page = document.page(at: i) else { continue }
            let bounds = page.bounds(for: .mediaBox)
            let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)

            let renderer = UIGraphicsImageRenderer(size: size)
            let img = renderer.image { ctx in
                UIColor.white.set()
                ctx.fill(CGRect(origin: .zero, size: size))

                let cgContext = ctx.cgContext
                cgContext.translateBy(x: 0, y: size.height)
                cgContext.scaleBy(x: scale, y: -scale)
                page.draw(with: .mediaBox, to: cgContext)
            }
            images.append(img)
        }
        return images
    }
}
