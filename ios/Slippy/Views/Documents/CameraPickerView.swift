import SwiftUI
import PhotosUI
import VisionKit
import CoreImage
import CoreImage.CIFilterBuiltins
import UniformTypeIdentifiers

enum PickerMode { case select, preview }

struct CameraPickerView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var mode: PickerMode = .select
    /// All pages captured this session (document scanner supports multi-page)
    @State private var pages: [UIImage] = []
    @State private var selectedPage = 0
    @State private var showPhotoPicker = false
    @State private var showScanner     = false
    @State private var showFileImport  = false
    @State private var photoItem: PhotosPickerItem?
    @State private var isUploading     = false
    @State private var uploadSuccess   = false
    @State private var isEnhancing     = false
    @State private var showSimulatorHint = false
    @State private var error: String?

    private var pickedImage: UIImage? {
        pages.indices.contains(selectedPage) ? pages[selectedPage] : nil
    }

    var body: some View {
        NavigationStack {
            Group {
                if mode == .select { selectModeView }
                else               { previewModeView }
            }
            .navigationTitle(mode == .select ? "เพิ่มเอกสาร" : "ตรวจสอบก่อนอัพโหลด")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ยกเลิก") { dismiss() }
                        .foregroundColor(Color.brand500)
                }
            }
            // ── VisionKit document scanner: auto edge-detect + perspective
            //    correction + multi-page — the most accurate capture path
            //    for OCR on iPhone.
            .fullScreenCover(isPresented: $showScanner) {
                DocumentScannerView { scannedPages in
                    Task { await ingestScannedPages(scannedPages) }
                }
                .ignoresSafeArea()
            }
            .fileImporter(isPresented: $showFileImport,
                          allowedContentTypes: [.pdf, .image]) { result in
                if case .success(let url) = result {
                    handleFile(url: url)
                }
            }
            .alert("กล้องไม่พร้อมใช้งานบน Simulator", isPresented: $showSimulatorHint) {
                Button("ใช้ภาพตัวอย่างทดสอบ") {
                    Task { await ingestScannedPages([SampleDocumentGenerator.makeReceipt()]) }
                }
                Button("เลือกจากคลังภาพแทน", role: .cancel) { showPhotoPicker = true }
            } message: {
                Text("Simulator บน Mac ไม่มีกล้องจริง ระบบจะสร้างภาพเอกสารตัวอย่างให้ทดสอบขั้นตอนถ่าย-ปรับปรุง-อัพโหลดแทนกล้องจริงได้ทันที")
            }
            .photosPicker(isPresented: $showPhotoPicker, selection: $photoItem, matching: .images)
        }
        .onChange(of: photoItem) { _, item in
            Task {
                guard let data  = try? await item?.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                await ingestScannedPages([image])
            }
        }
    }

    /// Runs every captured page through the OCR-enhancement pipeline,
    /// then transitions to the preview screen.
    private func ingestScannedPages(_ raw: [UIImage]) async {
        guard !raw.isEmpty else { return }
        isEnhancing = true
        let enhanced = await withTaskGroup(of: (Int, UIImage).self) { group -> [UIImage] in
            for (i, img) in raw.enumerated() {
                group.addTask { (i, DocumentEnhancer.enhance(img)) }
            }
            var results = [Int: UIImage]()
            for await (i, img) in group { results[i] = img }
            return (0..<raw.count).compactMap { results[$0] }
        }
        await MainActor.run {
            pages = enhanced
            selectedPage = 0
            mode = .preview
            isEnhancing = false
            hapticSuccess()
        }
    }

    // MARK: – Select Mode
    private var selectModeView: some View {
        VStack(spacing: 20) {
            Spacer()

            Text("เลือกวิธีอัพโหลดเอกสาร")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(Color.textPrimary)

            VStack(spacing: 12) {
                uploadOption("กล้องถ่ายรูป", "camera.fill",
                             LinearGradient(colors: [Color.brand500, Color.brand600],
                                            startPoint: .topLeading, endPoint: .bottomTrailing)) {
                    hapticLight()
                    // The Mac Simulator has no physical camera — VNDocumentCameraViewController
                    // would just show a black screen. Detect that up front and offer a
                    // generated sample document instead, so the whole capture → enhance →
                    // upload pipeline remains testable end-to-end on the Simulator.
                    if DocumentScannerView.isSupported {
                        showScanner = true
                    } else {
                        showSimulatorHint = true
                    }
                }
                PhotosPicker(selection: $photoItem, matching: .images) {
                    uploadOptionLabel("คลังภาพ", "photo.on.rectangle",
                                     LinearGradient(colors: [Color(hex: "#10b981"), Color(hex: "#059669")],
                                                    startPoint: .topLeading, endPoint: .bottomTrailing))
                }
                .buttonStyle(.plain)
                uploadOption("ไฟล์ PDF", "doc.richtext",
                             LinearGradient(colors: [Color(hex: "#f59e0b"), Color(hex: "#d97706")],
                                            startPoint: .topLeading, endPoint: .bottomTrailing)) {
                    hapticLight()
                    showFileImport = true
                }
            }
            .padding(.horizontal, 24)

            Spacer()
        }
        .background(Color(hex: "#f8f9fc"))
    }

    @ViewBuilder
    private func uploadOption(_ title: String, _ icon: String,
                               _ gradient: LinearGradient, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            uploadOptionLabel(title, icon, gradient)
        }
    }

    @ViewBuilder
    private func uploadOptionLabel(_ title: String, _ icon: String,
                                    _ gradient: LinearGradient) -> some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundColor(.white)
                .frame(width: 52, height: 52)
                .background(gradient)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            Text(title)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(Color.textPrimary)
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundColor(Color.textSecondary)
        }
        .padding(18)
        .background(Color.surface)
        .cornerRadius(18)
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.border))
    }

    // MARK: – Preview Mode
    private var previewModeView: some View {
        VStack(spacing: 20) {
            if let img = pickedImage {
                Image(uiImage: img)
                    .resizable()
                    .scaledToFit()
                    .cornerRadius(16)
                    .padding(.horizontal, 20)
                    .shadow(color: .black.opacity(0.1), radius: 12, x: 0, y: 4)
            }

            if let error = error {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                    Text(error).font(.system(size: 13)).foregroundColor(.red)
                }
                .padding(12)
                .background(Color(hex: "#fef2f2"))
                .cornerRadius(10)
                .padding(.horizontal, 20)
            }

            if uploadSuccess {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Color.statusApproved)
                    Text("อัพโหลดสำเร็จ! AI กำลังประมวลผล…")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color.statusApproved)
                }
                .padding(12)
                .background(Color(hex: "#f0fdf4"))
                .cornerRadius(10)
                .padding(.horizontal, 20)
            }

            Spacer()

            HStack(spacing: 12) {
                Button { mode = .select; pages = []; selectedPage = 0 } label: {
                    Text("เลือกใหม่")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(Color.brand500)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.brand50)
                        .cornerRadius(14)
                }
                Button { Task { await upload() } } label: {
                    Group {
                        if isUploading {
                            ProgressView().tint(.white)
                        } else {
                            Text("อัพโหลด")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.brand500)
                    .cornerRadius(14)
                }
                .disabled(isUploading || uploadSuccess)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
        .background(Color(hex: "#f8f9fc"))
    }

    // MARK: – Upload
    /// Uploads every captured/enhanced page as a separate document record.
    /// JPEG quality bumped to 0.94 — at this stage file size matters far less
    /// than preserving fine text detail for the OCR/AI pipeline.
    private func upload() async {
        guard !pages.isEmpty,
              let orgId  = authVM.org?.id,
              let userId = authVM.session?.user.id.uuidString
        else { return }

        isUploading = true
        error = nil
        hapticLight()
        let batchStamp = Date().timeIntervalSince1970

        do {
            for (index, img) in pages.enumerated() {
                guard let data = img.jpegData(compressionQuality: 0.94) else { continue }
                let suffix   = pages.count > 1 ? "_p\(index + 1)" : ""
                let fileName = "\(userId)_\(batchStamp)\(suffix).jpg"
                let path     = "\(orgId)/\(fileName)"

                try await SupabaseManager.shared.client
                    .storage
                    .from(Config.storageBucket)
                    .upload(path, data: data, options: .init(upsert: false))

                // NOTE: `documents` has no `file_name` column — only `file_path`
                // (see supabase/migrations/001_core_schema.sql). `file_type` is
                // NOT NULL with a CHECK ('pdf'|'jpg'|'png'), so it must be sent.
                let record: [String: String] = [
                    "organization_id": orgId,
                    "uploaded_by":      userId,
                    "file_path":        path,
                    "file_type":        "jpg",
                    "status":           "processing",
                    "source":           "mobile"
                ]
                try await SupabaseManager.shared.client
                    .from("documents")
                    .insert(record)
                    .execute()
            }

            isUploading  = false
            uploadSuccess = true
            hapticSuccess()
        } catch {
            isUploading  = false
            self.error   = error.localizedDescription
        }
    }

    /// Renders every page of an imported PDF at high DPI (2x) and runs each
    /// page through the same OCR-enhancement pipeline used for camera scans,
    /// so PDF imports get equally accurate output.
    private func handleFile(url: URL) {
        guard url.pathExtension.lowercased() == "pdf" else {
            // Plain image file picked via the importer
            if let data = try? Data(contentsOf: url), let img = UIImage(data: data) {
                Task { await ingestScannedPages([img]) }
            }
            return
        }
        Task {
            isEnhancing = true
            let rendered = PDFRenderer.renderPages(at: url, scale: 2.0)
            await ingestScannedPages(rendered)
        }
    }
}

#if DEBUG
#Preview {
    let vm = AuthViewModel(_preview: true)
    vm.setPreviewData(
        profile: UserProfile(id: "u1", email: "demo@slippy.app", fullName: "สมชาย ใจดี", avatarUrl: nil),
        org: Organization(id: "demo-org", name: "บริษัท Demo จำกัด", plan: "pro", docQuota: 200, docUsed: 45)
    )
    return CameraPickerView().environmentObject(vm)
}
#endif

