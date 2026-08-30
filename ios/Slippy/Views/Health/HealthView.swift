import SwiftUI
import PhotosUI

private let healthGreen = Color(hex: "#10b981")

struct HealthView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var vm = HealthViewModel()
    @State private var showAddMed = false
    @State private var actionTarget: Medication? = nil
    @State private var showLogSheet = false

    // MARK: – Scan-a-label flow: pick a photo → OCR (read-only) → the SAME
    // add-medication form, pre-filled — nothing is ever written until it goes
    // through the one review step every path into `medications` already goes
    // through. Mirrors web's scan flow in medications-client.tsx exactly.
    @State private var showScanSource = false
    @State private var showScanPhotoPicker = false
    @State private var showScanCamera = false
    @State private var scanPhotoItem: PhotosPickerItem?
    @State private var scanning = false
    @State private var scanError: String?
    @State private var scanIssues: [String] = []
    /// More than one label caught in one photo — pick which to review first.
    @State private var scanResults: [ScannedMedication]?
    @State private var scanReviewing: ScannedMedication?

    private var userId: String { authVM.session?.user.id.uuidString ?? "" }

    // No NavigationStack here — always reached via a NavigationLink push
    // from Dashboard or the "เพิ่มเติม" hub, both of which already own one.
    // A second NavigationStack here swallows the outer back button.
    var body: some View {
            ScrollView {
                VStack(spacing: 18) {
                    summaryCard
                        .padding(.horizontal, 16)
                        .padding(.top, 12)

                    if !vm.notificationsAuthorized && vm.medications.contains(where: { $0.primarySchedule?.reminderEnabled == true }) {
                        notificationBanner
                            .padding(.horizontal, 16)
                    }

                    medicationsSection
                        .padding(.horizontal, 16)

                    healthTipsSection
                        .padding(.horizontal, 16)
                        .padding(.bottom, 32)
                }
            }
            .background(Color.background.ignoresSafeArea())
            .navigationTitle("สุขภาพ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        hapticLight()
                        showAddMed = true
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                            .foregroundColor(healthGreen)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        hapticLight()
                        showScanSource = true
                    } label: {
                        Image(systemName: "text.viewfinder")
                            .fontWeight(.semibold)
                            .foregroundColor(healthGreen)
                    }
                }
            }
            .task {
                guard !userId.isEmpty else { return }
                await vm.load(userId: userId)
            }
            .refreshable {
                guard !userId.isEmpty else { return }
                await vm.load(userId: userId)
            }
            .sheet(isPresented: $showAddMed) {
                AddMedicationView(vm: vm)
                    .environmentObject(authVM)
            }
            .confirmationDialog(
                actionTarget.map { "บันทึกการทานยา: \($0.name)" } ?? "",
                isPresented: $showLogSheet,
                titleVisibility: .visible
            ) {
                if let med = actionTarget {
                    Button("ทานแล้ว ✅") { logMed(med, status: "taken") }
                    Button("ลืมทาน ❌") { logMed(med, status: "missed") }
                    Button("ข้าม ⏭️") { logMed(med, status: "skipped") }
                    Button("ยกเลิก", role: .cancel) {}
                }
            }
            // MARK: – Scan-a-label
            .confirmationDialog("สแกนฉลากยา", isPresented: $showScanSource, titleVisibility: .visible) {
                Button("ถ่ายรูป") { showScanCamera = true }
                Button("เลือกจากคลังภาพ") { showScanPhotoPicker = true }
                Button("ยกเลิก", role: .cancel) {}
            }
            .photosPicker(isPresented: $showScanPhotoPicker, selection: $scanPhotoItem, matching: .images)
            .onChange(of: scanPhotoItem) { _, item in
                guard let item else { return }
                Task {
                    scanPhotoItem = nil
                    guard let data = try? await item.loadTransferable(type: Data.self) else {
                        scanError = "อ่านรูปไม่สำเร็จ"; return
                    }
                    await scanLabel(data: data)
                }
            }
            .fullScreenCover(isPresented: $showScanCamera) {
                // CameraImagePicker dismisses itself via @Environment(\.dismiss)
                // before calling onImage — see its own doc comment on why a
                // second manual dismiss here would tear down this sheet too.
                CameraImagePicker { img in
                    guard let data = img.jpegData(compressionQuality: 0.9) else { return }
                    Task { await scanLabel(data: data) }
                }
            }
            .overlay {
                if scanning {
                    ZStack {
                        Color.black.opacity(0.35).ignoresSafeArea()
                        VStack(spacing: 10) {
                            ProgressView().tint(.white)
                            Text("กำลังอ่านฉลากยา…")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.white)
                        }
                        .padding(24)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
            .alert("ไม่สำเร็จ", isPresented: Binding(
                get: { scanError != nil }, set: { if !$0 { scanError = nil } }
            )) {
                Button("ตกลง") { scanError = nil }
            } message: { Text(scanError ?? "") }
            .confirmationDialog(
                scanResults.map { "พบยา \($0.count) รายการในภาพนี้" } ?? "",
                isPresented: Binding(get: { scanResults != nil }, set: { if !$0 { scanResults = nil } }),
                titleVisibility: .visible
            ) {
                ForEach(scanResults ?? [], id: \.name) { item in
                    Button(item.name + (item.strength.map { " \($0)" } ?? "")) {
                        scanReviewing = item
                        scanResults = nil
                    }
                }
                Button("ยกเลิก", role: .cancel) { scanResults = nil }
            }
            .sheet(isPresented: Binding(
                get: { scanReviewing != nil }, set: { if !$0 { scanReviewing = nil } }
            )) {
                AddMedicationView(vm: vm, scanned: scanReviewing, scanIssues: scanIssues)
                    .environmentObject(authVM)
            }
    }

    private func scanLabel(data: Data) async {
        scanning = true
        defer { scanning = false }
        do {
            let result = try await MedicationScanAPI.read(imageData: data, fileName: "label.jpg", mimeType: "image/jpeg")
            scanIssues = result.issues
            guard !result.items.isEmpty else {
                scanError = "อ่านฉลากยาไม่พบรายการที่ใช้ได้"
                return
            }
            // One label, the common case: skip straight to the review form.
            // More than one (a photo catching two packs) shows a pick list.
            if result.items.count == 1 {
                scanReviewing = result.items[0]
            } else {
                scanResults = result.items
            }
        } catch {
            scanError = error.localizedDescription
        }
    }

    // MARK: – Summary card
    private var summaryCard: some View {
        let total = vm.medications.count
        let taken = vm.takenCountToday
        let progress = total > 0 ? Double(taken) / Double(total) : 0

        return ZStack {
            RoundedRectangle(cornerRadius: 18)
                .fill(LinearGradient(
                    colors: [Color(hex: "#059669"), healthGreen],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .shadow(color: healthGreen.opacity(0.3), radius: 12, x: 0, y: 6)

            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("วันนี้")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white.opacity(0.85))
                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text("\(taken)")
                            .font(.system(size: 36, weight: .heavy))
                            .foregroundColor(.white)
                        Text("/ \(total) รายการ")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white.opacity(0.8))
                    }
                    Text(taken == total && total > 0 ? "ทานยาครบแล้ว 🎉" : "ยาที่ทานแล้ว")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white.opacity(0.8))
                }
                Spacer()
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.25), lineWidth: 8)
                        .frame(width: 72, height: 72)
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .frame(width: 72, height: 72)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut(duration: 0.6), value: progress)
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            .padding(20)
        }
    }

    // MARK: – Notification permission banner
    //
    // Shown only when a medication actually wants a reminder AND the OS
    // hasn't granted permission — a schedule with `reminder_enabled` but no
    // authorization is a reminder that silently never fires, which reads as
    // "the app is broken" rather than "tap here to turn it on."
    private var notificationBanner: some View {
        Button {
            hapticLight()
            Task { await vm.requestNotificationPermission() }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "bell.badge")
                    .font(.system(size: 18))
                    .foregroundColor(.white)
                VStack(alignment: .leading, spacing: 2) {
                    Text("เปิดแจ้งเตือนบนมือถือ")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                    Text("เพื่อให้ Slippy เตือนเวลาทานยาบนเครื่องนี้")
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.85))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(14)
            .background(Color(hex: "#f59e0b"))
            .cornerRadius(14)
        }
    }

    // MARK: – Medications section
    private var medicationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("ยาของฉัน")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.textPrimary)

            if vm.isLoading {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .padding(.vertical, 20)
            } else if vm.medications.isEmpty {
                emptyState
            } else {
                ForEach(vm.medications) { med in
                    MedicationCard(med: med, status: vm.todayStatus(for: med.id))
                        .onTapGesture {
                            hapticLight()
                            actionTarget = med
                            showLogSheet = true
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task { try? await vm.deleteMedication(id: med.id) }
                            } label: {
                                Label("ลบ", systemImage: "trash")
                            }
                        }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Text("💊")
                .font(.system(size: 44))
            Text("ยังไม่มียาที่บันทึก")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.textSecondary)
            Button {
                hapticLight()
                showAddMed = true
            } label: {
                Text("เพิ่มยา")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(healthGreen)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(healthGreen.opacity(0.12))
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .background(Color.surface)
        .cornerRadius(14)
    }

    // MARK: – Health tips
    private var healthTipsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("เคล็ดลับสุขภาพ")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.textPrimary)

            VStack(spacing: 10) {
                ForEach(healthTips, id: \.icon) { tip in
                    HStack(spacing: 12) {
                        Text(tip.icon)
                            .font(.system(size: 22))
                            .frame(width: 40, height: 40)
                            .background(Color(hex: "#f0fdf4"))
                            .cornerRadius(10)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tip.title)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.textPrimary)
                            Text(tip.detail)
                                .font(.system(size: 11))
                                .foregroundColor(.textSecondary)
                        }
                        Spacer()
                    }
                    .padding(12)
                    .background(Color.surface)
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 2)
                }
            }
        }
    }

    private func logMed(_ med: Medication, status: String) {
        Task {
            try? await vm.logMedication(userId: userId, medicationId: med.id, status: status)
            hapticSuccess()
        }
    }
}

// MARK: – Medication card
private struct MedicationCard: View {
    let med: Medication
    let status: String

    private var statusColor: Color {
        switch status {
        case "taken":   return .green
        case "missed":  return .red
        case "skipped": return .orange
        default:        return .gray
        }
    }

    private var statusLabel: String {
        switch status {
        case "taken":   return "ทานแล้ว"
        case "missed":  return "ลืมทาน"
        case "skipped": return "ข้าม"
        default:        return "รอทาน"
        }
    }

    var body: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(statusColor.opacity(0.15))
                .frame(width: 44, height: 44)
                .overlay(
                    Text(med.dosageForm == "liquid" || med.dosageForm == "cream" ? "🧴" : med.dosageForm == "inhaler" ? "💨" : med.dosageForm == "injection" ? "💉" : med.dosageForm == "patch" ? "🩹" : "💊")
                        .font(.system(size: 22))
                )

            VStack(alignment: .leading, spacing: 3) {
                Text(med.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.textPrimary)
                HStack(spacing: 6) {
                    Text(med.dosageFormLabel)
                        .font(.system(size: 11))
                        .foregroundColor(.textSecondary)
                    if let brand = med.brandName, !brand.isEmpty {
                        Text("·")
                            .foregroundColor(.border)
                        Text(brand)
                            .font(.system(size: 11))
                            .foregroundColor(.textSecondary)
                    }
                    if let sched = med.primarySchedule, !sched.times.isEmpty {
                        Text("· ⏰ \(sched.times.joined(separator: ", "))")
                            .font(.system(size: 11))
                            .foregroundColor(.textSecondary)
                    }
                }
                if let inv = med.inventory {
                    let daysLeft = inv.daysRemaining(schedule: med.primarySchedule)
                    let lowStock = inv.qtyRemaining <= inv.lowStockAlert
                    HStack(spacing: 4) {
                        if lowStock {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 9))
                        }
                        Text(daysLeft.map { "เหลือ \(inv.qtyRemaining.clean) \(inv.qtyUnit) · อีก \($0) วัน" }
                            ?? "เหลือ \(inv.qtyRemaining.clean) \(inv.qtyUnit)")
                            .font(.system(size: 10, weight: lowStock ? .semibold : .regular))
                    }
                    .foregroundColor(lowStock ? .red : .textSecondary)
                }
            }

            Spacer()

            Text(statusLabel)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(statusColor)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(statusColor.opacity(0.12))
                .clipShape(Capsule())
        }
        .padding(14)
        .background(Color.surface)
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 2)
    }
}

// MARK: – Health tips data
private struct HealthTip {
    let icon: String
    let title: String
    let detail: String
}

private let healthTips: [HealthTip] = [
    HealthTip(icon: "💧", title: "ดื่มน้ำ 8 แก้วต่อวัน", detail: "ช่วยระบบการทำงานของร่างกายให้สมบูรณ์"),
    HealthTip(icon: "😴", title: "นอนหลับ 7-8 ชั่วโมง", detail: "ร่างกายซ่อมแซมตัวเองได้ดีที่สุดในช่วงหลับ"),
    HealthTip(icon: "🏃", title: "ออกกำลังกาย 30 นาที/วัน", detail: "ลดความเสี่ยงโรคหัวใจและเบาหวาน"),
    HealthTip(icon: "🥗", title: "ทานผักผลไม้ให้ครบ 5 หมู่", detail: "วิตามินและแร่ธาตุจากธรรมชาติดีที่สุด"),
]
