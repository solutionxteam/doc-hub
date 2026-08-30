import SwiftUI

private let healthGreen = Color(hex: "#10b981")

struct AddMedicationView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @ObservedObject var vm: HealthViewModel
    @Environment(\.dismiss) private var dismiss

    /// Pre-fill from a scanned label — still just a starting point, every
    /// field below stays editable, and nothing is written until Save. Same
    /// role as web's AddMedicationModal `scanned` prop.
    var scanned: ScannedMedication? = nil
    var scanIssues: [String] = []

    /// Set to edit an existing medication in place, instead of creating one.
    /// Mutually exclusive with `scanned` — editing an existing row is never
    /// also a fresh scan review.
    var editing: Medication? = nil

    @State private var name: String
    @State private var brandName: String
    @State private var dosageForm: String
    @State private var strength: String
    @State private var purpose: String
    @State private var notes = ""
    @State private var isSaving = false
    @State private var errorMsg: String?

    // Schedule + inventory — without these there is nothing for
    // HealthViewModel.syncReminderNotifications to schedule, and no daily
    // rate to estimate a run-out date from.
    @State private var times: [String]
    @State private var doseQty: String
    @State private var mealRelation: String
    @State private var reminderEnabled = true
    @State private var qtyTotal: String
    @State private var lowStockAlert = "7"
    @State private var hasExpiry: Bool
    @State private var expiryDate: Date

    init(vm: HealthViewModel, scanned: ScannedMedication? = nil, scanIssues: [String] = [], editing: Medication? = nil) {
        self.vm = vm
        self.scanned = scanned
        self.scanIssues = scanIssues
        self.editing = editing
        let sched = editing?.primarySchedule
        let inv = editing?.inventory
        _name        = State(initialValue: editing?.name ?? scanned?.name ?? "")
        _brandName   = State(initialValue: editing?.brandName ?? scanned?.brandName ?? "")
        _dosageForm  = State(initialValue: editing?.dosageForm ?? scanned?.dosageForm ?? "tablet")
        _strength    = State(initialValue: editing?.strength ?? scanned?.strength ?? "")
        _purpose     = State(initialValue: editing?.purpose ?? scanned?.purpose ?? "")
        _notes       = State(initialValue: editing?.notes ?? "")
        _times       = State(initialValue: (sched?.times.isEmpty == false ? sched?.times
                              : (scanned?.times.isEmpty == false ? scanned?.times : nil)) ?? ["08:00"])
        _doseQty     = State(initialValue: String(sched?.doseQty ?? scanned?.doseQty ?? 1))
        _mealRelation = State(initialValue: sched?.mealRelation ?? scanned?.mealRelation ?? "after")
        _reminderEnabled = State(initialValue: sched?.reminderEnabled ?? true)
        _qtyTotal    = State(initialValue: inv.map { String(Int($0.qtyRemaining)) }
                              ?? scanned?.qtyTotal.map { String(Int($0)) } ?? "")
        _lowStockAlert = State(initialValue: inv.map { String(Int($0.lowStockAlert)) } ?? "7")
        let expiry = (inv?.expiryDate ?? scanned?.expiryDate).flatMap(Self.date(fromISODate:))
        _hasExpiry   = State(initialValue: expiry != nil)
        _expiryDate  = State(initialValue: expiry ?? Date())
    }

    private let mealOptions: [(value: String, label: String)] = [
        ("before", "ก่อนอาหาร"), ("after", "หลังอาหาร"), ("with", "พร้อมอาหาร"), ("any", "ไม่ระบุ"),
    ]

    private let dosageForms: [(value: String, label: String)] = [
        ("tablet",    "💊 เม็ด"),
        ("capsule",   "💊 แคปซูล"),
        ("liquid",    "🧴 น้ำ"),
        ("inhaler",   "💨 พ่น"),
        ("injection", "💉 ฉีด"),
        ("patch",     "🩹 แผ่นแปะ"),
        ("cream",     "🧴 ครีม"),
        ("other",     "💊 อื่นๆ"),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    if let scanned {
                        scanInfoBanner(scanned)
                    }

                    // Name field
                    fieldSection(title: "ชื่อยา *") {
                        TextField("เช่น Paracetamol", text: $name)
                            .font(.system(size: 15))
                            .padding(12)
                            .background(Color.background)
                            .cornerRadius(10)
                    }

                    // Brand name field
                    fieldSection(title: "ชื่อการค้า (ไม่บังคับ)") {
                        TextField("เช่น Tylenol, Sara", text: $brandName)
                            .font(.system(size: 15))
                            .padding(12)
                            .background(Color.background)
                            .cornerRadius(10)
                    }

                    HStack(spacing: 12) {
                        fieldSection(title: "ความแรง") {
                            TextField("5mg, 500mg", text: $strength)
                                .font(.system(size: 15))
                                .padding(12)
                                .background(Color.background)
                                .cornerRadius(10)
                        }
                        fieldSection(title: "ใช้สำหรับ") {
                            TextField("ลดความดัน, วิตามิน", text: $purpose)
                                .font(.system(size: 15))
                                .padding(12)
                                .background(Color.background)
                                .cornerRadius(10)
                        }
                    }

                    // Dosage form picker
                    fieldSection(title: "รูปแบบยา") {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            ForEach(dosageForms, id: \.value) { form in
                                Button {
                                    hapticLight()
                                    dosageForm = form.value
                                } label: {
                                    Text(form.label)
                                        .font(.system(size: 13, weight: .medium))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background(dosageForm == form.value ? healthGreen.opacity(0.15) : Color.background)
                                        .foregroundColor(dosageForm == form.value ? healthGreen : .textSecondary)
                                        .cornerRadius(10)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10)
                                                .stroke(dosageForm == form.value ? healthGreen : Color.border, lineWidth: 1.5)
                                        )
                                }
                            }
                        }
                    }

                    // Reminder schedule
                    fieldSection(title: "เวลาแจ้งเตือน") {
                        VStack(spacing: 8) {
                            ForEach(times.indices, id: \.self) { i in
                                HStack(spacing: 8) {
                                    DatePicker("", selection: Binding(
                                        get: { Self.time(from: times[i]) },
                                        set: { times[i] = Self.timeString(from: $0) }
                                    ), displayedComponents: .hourAndMinute)
                                    .labelsHidden()
                                    Spacer()
                                    if times.count > 1 {
                                        Button {
                                            times.remove(at: i)
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .foregroundColor(.textSecondary)
                                        }
                                    }
                                }
                            }
                            Button {
                                hapticLight()
                                times.append("12:00")
                            } label: {
                                Label("เพิ่มเวลา", systemImage: "plus.circle")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(healthGreen)
                            }
                        }
                        .padding(12)
                        .background(Color.background)
                        .cornerRadius(10)
                    }

                    HStack(spacing: 12) {
                        fieldSection(title: "กี่เม็ดต่อครั้ง") {
                            TextField("1", text: $doseQty)
                                .keyboardType(.decimalPad)
                                .font(.system(size: 15))
                                .padding(12)
                                .background(Color.background)
                                .cornerRadius(10)
                        }
                        fieldSection(title: "ช่วงเวลาอาหาร") {
                            Picker("", selection: $mealRelation) {
                                ForEach(mealOptions, id: \.value) { Text($0.label).tag($0.value) }
                            }
                            .pickerStyle(.menu)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.background)
                            .cornerRadius(10)
                        }
                    }

                    Toggle(isOn: $reminderEnabled) {
                        Text("แจ้งเตือนบนมือถือ")
                            .font(.system(size: 14, weight: .medium))
                    }
                    .tint(healthGreen)

                    // Inventory
                    HStack(spacing: 12) {
                        fieldSection(title: "จำนวนที่มี") {
                            TextField("30", text: $qtyTotal)
                                .keyboardType(.decimalPad)
                                .font(.system(size: 15))
                                .padding(12)
                                .background(Color.background)
                                .cornerRadius(10)
                        }
                        fieldSection(title: "แจ้งเตือนเมื่อเหลือ") {
                            TextField("7", text: $lowStockAlert)
                                .keyboardType(.decimalPad)
                                .font(.system(size: 15))
                                .padding(12)
                                .background(Color.background)
                                .cornerRadius(10)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Toggle(isOn: $hasExpiry) {
                            Text("วันหมดอายุ")
                                .font(.system(size: 14, weight: .medium))
                        }
                        .tint(healthGreen)
                        if hasExpiry {
                            DatePicker("", selection: $expiryDate, displayedComponents: .date)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                        }
                    }

                    // Notes field
                    fieldSection(title: "หมายเหตุ (ไม่บังคับ)") {
                        TextField("เช่น ทานหลังอาหาร, ทาน 1 เม็ด เช้า-เย็น", text: $notes, axis: .vertical)
                            .font(.system(size: 15))
                            .lineLimit(3, reservesSpace: true)
                            .padding(12)
                            .background(Color.background)
                            .cornerRadius(10)
                    }

                    if let err = errorMsg {
                        Text(err)
                            .font(.system(size: 12))
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    // Save button
                    Button {
                        Task { await save() }
                    } label: {
                        HStack {
                            if isSaving {
                                ProgressView().tint(.white)
                            } else {
                                Text(editing != nil ? "บันทึกการแก้ไข" : "บันทึกยา")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(.white)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(name.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray.opacity(0.3) : healthGreen)
                        .cornerRadius(14)
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                    .padding(.top, 4)
                }
                .padding(20)
            }
            .background(Color.surface.ignoresSafeArea())
            .navigationTitle(editing != nil ? "แก้ไขยา" : (scanned != nil ? "ตรวจสอบก่อนบันทึก" : "เพิ่มยา"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("ยกเลิก") { dismiss() }
                        .foregroundColor(.textSecondary)
                }
            }
        }
    }

    @ViewBuilder
    private func fieldSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.textSecondary)
            content()
        }
    }

    private func save() async {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        guard let userId = authVM.session?.user.id.uuidString else { return }

        isSaving = true
        errorMsg = nil
        defer { isSaving = false }

        do {
            if let editing {
                try await vm.updateMedication(
                    id: editing.id,
                    scheduleId: editing.primarySchedule?.id,
                    inventoryId: editing.inventory?.id,
                    name: trimmedName,
                    brandName: brandName.trimmingCharacters(in: .whitespaces),
                    dosageForm: dosageForm,
                    notes: notes.trimmingCharacters(in: .whitespaces),
                    strength: strength.trimmingCharacters(in: .whitespaces),
                    purpose: purpose.trimmingCharacters(in: .whitespaces),
                    times: times,
                    doseQty: Double(doseQty) ?? 1,
                    mealRelation: mealRelation,
                    reminderEnabled: reminderEnabled,
                    qtyRemaining: Double(qtyTotal) ?? 0,
                    qtyUnit: "เม็ด",
                    lowStockAlert: Double(lowStockAlert) ?? 7,
                    expiryDate: hasExpiry ? Self.isoDateString(from: expiryDate) : nil
                )
            } else {
                try await vm.addMedication(
                    userId: userId,
                    name: trimmedName,
                    brandName: brandName.trimmingCharacters(in: .whitespaces),
                    dosageForm: dosageForm,
                    notes: notes.trimmingCharacters(in: .whitespaces),
                    strength: strength.trimmingCharacters(in: .whitespaces),
                    purpose: purpose.trimmingCharacters(in: .whitespaces),
                    times: times,
                    doseQty: Double(doseQty) ?? 1,
                    mealRelation: mealRelation,
                    reminderEnabled: reminderEnabled,
                    qtyTotal: Double(qtyTotal) ?? 0,
                    qtyUnit: "เม็ด",
                    lowStockAlert: Double(lowStockAlert) ?? 7,
                    expiryDate: hasExpiry ? Self.isoDateString(from: expiryDate) : nil
                )
            }
            if reminderEnabled {
                await vm.requestNotificationPermission()
            }
            hapticSuccess()
            dismiss()
        } catch {
            errorMsg = "เกิดข้อผิดพลาด: \(error.localizedDescription)"
        }
    }

    private static func time(from hhmm: String) -> Date {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.date(from: hhmm) ?? Date()
    }

    private static func timeString(from date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }

    private static func date(fromISODate iso: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: iso)
    }

    private static func isoDateString(from date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.string(from: date)
    }

    // MARK: – Scan info banner
    //
    // Read-only context from the label the machine could not turn into a
    // form field — mirrors web's scan banner in AddMedicationModal
    // (medications-client.tsx). Shown so the person reviewing has the same
    // information the model had, not just its conclusions.
    @ViewBuilder
    private func scanInfoBanner(_ scanned: ScannedMedication) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("อ่านจากฉลากยา — ตรวจให้ตรงกับซองยาก่อนบันทึก", systemImage: "text.viewfinder")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(healthGreen)

            if let verbatim = scanned.instructionsVerbatim, !verbatim.isEmpty {
                Text("“\(verbatim)”")
                    .font(.system(size: 12))
                    .foregroundColor(.textSecondary)
            }
            if scanned.hospitalName != nil || scanned.prescribingDoctor != nil {
                Text([scanned.hospitalName, scanned.prescribingDoctor].compactMap { $0 }.joined(separator: " · "))
                    .font(.system(size: 11))
                    .foregroundColor(.textSecondary)
            }
            if scanned.times.isEmpty {
                Label("อ่านช่วงเวลาไม่ได้ — ใส่เวลาแจ้งเตือนเองด้านล่าง", systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.orange)
            }
            ForEach(scanIssues, id: \.self) { issue in
                Label(issue, systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.orange)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(healthGreen.opacity(0.08))
        .cornerRadius(10)
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(healthGreen.opacity(0.25), lineWidth: 1))
    }
}
