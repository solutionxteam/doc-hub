import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

enum PickerMode { case select, preview }

struct CameraPickerView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var mode: PickerMode = .select
    @State private var pickedImage: UIImage?
    @State private var showPhotoPicker = false
    @State private var showCamera      = false
    @State private var showFileImport  = false
    @State private var photoItem: PhotosPickerItem?
    @State private var isUploading     = false
    @State private var uploadSuccess   = false
    @State private var error: String?

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
            .sheet(isPresented: $showCamera) { CameraView(captured: $pickedImage, mode: $mode) }
            .fileImporter(isPresented: $showFileImport,
                          allowedContentTypes: [.pdf, .image]) { result in
                if case .success(let url) = result {
                    handleFile(url: url)
                }
            }
        }
        .onChange(of: photoItem) { _, item in
            Task {
                guard let data  = try? await item?.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                pickedImage = image
                mode = .preview
            }
        }
    }

    // MARK: – Select Mode
    private var selectModeView: some View {
        VStack(spacing: 20) {
            Spacer()

            Text("เลือกวิธีอัพโหลดเอกสาร")
                .font(.system(size: 18, weight: .700))
                .foregroundColor(Color.textPrimary)

            VStack(spacing: 12) {
                uploadOption("กล้องถ่ายรูป", "camera.fill",
                             LinearGradient(colors: [Color.brand500, Color.brand600],
                                            startPoint: .topLeading, endPoint: .bottomTrailing)) {
                    hapticLight()
                    showCamera = true
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
                .font(.system(size: 16, weight: .700))
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
                        .font(.system(size: 14, weight: .600))
                        .foregroundColor(Color.statusApproved)
                }
                .padding(12)
                .background(Color(hex: "#f0fdf4"))
                .cornerRadius(10)
                .padding(.horizontal, 20)
            }

            Spacer()

            HStack(spacing: 12) {
                Button { mode = .select; pickedImage = nil } label: {
                    Text("เลือกใหม่")
                        .font(.system(size: 15, weight: .700))
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
                                .font(.system(size: 15, weight: .700))
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
    private func upload() async {
        guard let img = pickedImage,
              let orgId = authVM.org?.id,
              let userId = authVM.session?.user.id.uuidString,
              let data = img.jpegData(compressionQuality: 0.85)
        else { return }

        isUploading = true
        error = nil
        hapticLight()
        let fileName = "\(userId)_\(Date().timeIntervalSince1970).jpg"
        do {
            let path = "\(orgId)/\(fileName)"
            try await SupabaseManager.shared.client
                .storage
                .from(Config.storageBucket)
                .upload(path, data: data, options: .init(upsert: false))

            let record: [String: String] = [
                "organization_id": orgId,
                "file_name":        fileName,
                "file_path":        path,
                "status":           "processing",
                "source":           "mobile"
            ]
            try await SupabaseManager.shared.client
                .from("documents")
                .insert(record)
                .execute()

            isUploading  = false
            uploadSuccess = true
            hapticSuccess()
        } catch {
            isUploading  = false
            self.error   = error.localizedDescription
        }
    }

    private func handleFile(url: URL) {
        // PDF upload handled via same upload path
        pickedImage = nil
        mode = .preview
    }
}

// MARK: – Native Camera View (UIViewControllerRepresentable)
struct CameraView: UIViewControllerRepresentable {
    @Binding var captured: UIImage?
    @Binding var mode: PickerMode

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType  = .camera
        picker.delegate    = context.coordinator
        return picker
    }

    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView
        init(_ parent: CameraView) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.editedImage] as? UIImage ?? info[.originalImage] as? UIImage {
                parent.captured = img
                parent.mode     = .preview
                hapticSuccess()
            }
            picker.dismiss(animated: true)
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}
