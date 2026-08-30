import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// Import a travel document — pick, review, accept.
///
/// The review step is the point, not a formality. Everything here comes from a
/// machine reading small print, and a machine-read value nobody compared to the
/// paper is the failure this codebase keeps producing: it reconciles perfectly
/// against itself forever after. So nothing is written until a person ticks it,
/// and entries that cannot be filed say why BEFORE you accept rather than after.
struct TripImportDocumentSheet: View {
    let tripId: String
    let onImported: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var photoItem: PhotosPickerItem?
    @State private var showFileImporter = false
    @State private var reading = false
    @State private var saving = false
    @State private var result: TripDocumentAPI.ReadResult?
    @State private var picked: Set<String> = []
    @State private var fileName = ""
    @State private var errorText: String?

    /// Dates the trip actually has — an entry on any other date cannot be filed.
    private var tripDates: Set<String> {
        Set((result?.tripDays ?? []).compactMap(\.date))
    }

    private func fits(_ item: TripDocumentAPI.Proposed) -> Bool {
        guard let date = item.date else { return false }
        return tripDates.contains(date)
    }

    var body: some View {
        NavigationStack {
            Group {
                if let result {
                    reviewList(result)
                } else {
                    picker
                }
            }
            .navigationTitle("นำเข้าเอกสาร")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ปิด") { dismiss() }
                }
                if result != nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(saving ? "กำลังเพิ่ม…" : "เพิ่ม (\(picked.count))") {
                            Task { await accept() }
                        }
                        .disabled(picked.isEmpty || saving)
                    }
                }
            }
            .alert("ไม่สำเร็จ", isPresented: .constant(errorText != nil)) {
                Button("ตกลง") { errorText = nil }
            } message: { Text(errorText ?? "") }
        }
    }

    // MARK: – Pick

    private var picker: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "doc.text.viewfinder")
                .font(.system(size: 44))
                .foregroundColor(Color.brand500)
            Text("ตั๋วเครื่องบิน ใบยืนยันโรงแรม ตั๋วรถไฟ เรือ หรือใบเช่ารถ")
                .font(.system(size: 13))
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Text("ระบบอ่านให้ ไม่ต้องพิมพ์เอง")
                .font(.system(size: 12))
                .foregroundColor(Color.textSecondary)

            if reading {
                ProgressView("กำลังอ่าน \(fileName)…")
                    .padding(.top, 10)
                Text("เอกสารหลายหน้าอาจใช้เวลาสักครู่")
                    .font(.system(size: 11))
                    .foregroundColor(Color.textSecondary)
            } else {
                VStack(spacing: 10) {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("เลือกรูปภาพ", systemImage: "photo")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)

                    Button {
                        showFileImporter = true
                    } label: {
                        Label("เลือกไฟล์ PDF", systemImage: "doc")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                .padding(.horizontal, 40)
                .padding(.top, 8)
            }
            Spacer()
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self) else {
                    errorText = "อ่านรูปไม่สำเร็จ"; return
                }
                await read(data: data, name: "photo.jpg", mime: "image/jpeg")
            }
        }
        .fileImporter(isPresented: $showFileImporter,
                      allowedContentTypes: [.pdf, .jpeg, .png]) { outcome in
            switch outcome {
            case .success(let url):
                Task {
                    // A file from the document picker lives outside the app's
                    // sandbox; without the security scope the read silently
                    // returns nothing.
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    guard let data = try? Data(contentsOf: url) else {
                        errorText = "อ่านไฟล์ไม่สำเร็จ"; return
                    }
                    let mime = url.pathExtension.lowercased() == "pdf" ? "application/pdf" : "image/jpeg"
                    await read(data: data, name: url.lastPathComponent, mime: mime)
                }
            case .failure(let err):
                errorText = err.localizedDescription
            }
        }
    }

    // MARK: – Review

    private func reviewList(_ r: TripDocumentAPI.ReadResult) -> some View {
        List {
            Section {
                HStack {
                    Image(systemName: "doc.text").foregroundColor(Color.brand500)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(r.documentKind).font(.system(size: 13, weight: .semibold))
                        Text("\(fileName) · \(r.pagesRead) หน้า")
                            .font(.system(size: 11)).foregroundColor(Color.textSecondary)
                    }
                    Spacer()
                    Button("เปลี่ยนไฟล์") {
                        result = nil; picked = []; photoItem = nil
                    }
                    .font(.system(size: 12, weight: .semibold))
                }
            }

            if !r.issues.isEmpty {
                Section("สิ่งที่ควรตรวจ") {
                    ForEach(r.issues, id: \.self) { issue in
                        Text(issue).font(.system(size: 11)).foregroundColor(Color.textSecondary)
                    }
                }
            }

            Section("รายการที่อ่านได้ (\(r.items.count))") {
                ForEach(r.items) { item in
                    row(item)
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func row(_ item: TripDocumentAPI.Proposed) -> some View {
        let spec = JourneyStyle.spec(item.type)
        let canFile = fits(item)
        let on = picked.contains(item.id)
        return Button {
            guard canFile else { return }
            hapticLight()
            if on { picked.remove(item.id) } else { picked.insert(item.id) }
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: on ? "checkmark.square.fill" : "square")
                    .foregroundColor(on ? Color.brand500 : Color.textSecondary)
                Image(systemName: spec.symbol)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(spec.color)
                    .frame(width: 26, height: 26)
                    .background(spec.color.opacity(0.14), in: RoundedRectangle(cornerRadius: 7))

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.textPrimary)
                    if let subtitle = item.subtitle {
                        Text(subtitle).font(.system(size: 11)).foregroundColor(Color.textSecondary)
                    }
                    Text([item.date ?? "ไม่มีวันที่",
                          item.timeFrom, item.confirmationCode,
                          item.amount.flatMap { $0 > 0 ? "\(Int($0)) \(item.currency ?? "")" : nil }]
                            .compactMap { $0 }.joined(separator: " · "))
                        .font(.system(size: 11))
                        .foregroundColor(Color.textSecondary)
                    if !canFile {
                        Label(item.date == nil
                              ? "เอกสารไม่ได้ระบุวันที่ — เพิ่มเองภายหลัง"
                              : "ทริปนี้ไม่มีวันที่ \(item.date!)",
                              systemImage: "calendar.badge.exclamationmark")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(Color.statusReviewing)
                    }
                }
                Spacer(minLength: 0)
            }
            .opacity(canFile ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!canFile)
    }

    // MARK: – Actions

    private func read(data: Data, name: String, mime: String) async {
        fileName = name
        reading = true
        defer { reading = false }
        do {
            let r = try await TripDocumentAPI.read(tripId: tripId, fileData: data,
                                                   fileName: name, mimeType: mime)
            result = r
            // Pre-tick only what can actually be filed — a ticked row that gets
            // skipped teaches the user to distrust the ticks.
            picked = Set(r.items.filter(fits).map(\.id))
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func accept() async {
        guard let r = result else { return }
        saving = true
        defer { saving = false }
        do {
            let chosen = r.items.filter { picked.contains($0.id) }
            let out = try await TripDocumentAPI.accept(tripId: tripId, items: chosen)
            hapticSuccess()
            await onImported()
            if !out.skipped.isEmpty {
                errorText = "เพิ่ม \(out.created) รายการ · ข้าม \(out.skipped.count): \(out.skipped[0])"
            } else {
                dismiss()
            }
        } catch {
            errorText = error.localizedDescription
        }
    }
}
