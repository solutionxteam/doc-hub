import SwiftUI
import Supabase
import UserNotifications

@MainActor
final class HealthViewModel: ObservableObject {
    @Published var medications: [Medication] = []
    @Published var todayLogs: [MedicationLog] = []
    @Published var isLoading = false
    @Published var error: String?
    /// Whether the OS has actually granted permission — drives the "แจ้งเตือน
    /// บนมือถือยังไม่เปิด" banner. Reminders can be scheduled with this false
    /// (UNUserNotificationCenter just silently drops them), so the UI needs
    /// its own read of the real authorization state, not an assumption.
    @Published var notificationsAuthorized = false

    private let db = SupabaseManager.shared.client

    func load(userId: String) async {
        isLoading = true
        defer { isLoading = false }
        async let medsTask: Void = loadMedications(userId: userId)
        async let logsTask: Void = loadTodayLogs(userId: userId)
        _ = await (medsTask, logsTask)
        await refreshNotificationAuthorization()
        syncReminderNotifications()
    }

    private func loadMedications(userId: String) async {
        do {
            // Embeds schedule + inventory in one round trip — PostgREST
            // resolves the FK the same way web's nested `.select(...)` does
            // (web/src/app/api/medications/route.ts), so this is the same
            // data shape on both surfaces.
            let rows: [Medication] = try await db
                .from("medications")
                .select("*, medication_schedules(*), medication_inventory(*)")
                .eq("user_id", value: userId)
                // Matches web's GET /api/medications — a soft-deleted medication
                // (deleteMedication below) must disappear from the list, not
                // just from wherever deleted it.
                .eq("is_active", value: true)
                .order("created_at", ascending: false)
                .execute()
                .value
            medications = rows
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadTodayLogs(userId: String) async {
        let today = todayDateString()
        let tomorrow = tomorrowDateString()
        do {
            let rows: [MedicationLog] = try await db
                .from("medication_logs")
                .select()
                .eq("user_id", value: userId)
                .gte("created_at", value: today)
                .lt("created_at", value: tomorrow)
                .order("created_at", ascending: false)
                .execute()
                .value
            todayLogs = rows
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Creates the medication AND its schedule/inventory rows in one call —
    /// matching web's POST /api/medications, which writes all three tables
    /// together (see AddMedicationModal there). A medication with no
    /// schedule has nothing for `syncReminderNotifications` to schedule and
    /// no daily rate to estimate a run-out date from, so this form collects
    /// both from the start rather than leaving them for a later edit that
    /// doesn't exist yet.
    func addMedication(
        userId: String, name: String, brandName: String?, dosageForm: String, notes: String?,
        strength: String? = nil, purpose: String? = nil,
        times: [String], doseQty: Double, mealRelation: String, reminderEnabled: Bool,
        qtyTotal: Double, qtyUnit: String, lowStockAlert: Double, expiryDate: String? = nil
    ) async throws {
        struct MedInsert: Encodable {
            let user_id: String
            let name: String
            let brand_name: String?
            let dosage_form: String
            let strength: String?
            let purpose: String?
            let notes: String?
        }
        struct MedRow: Decodable { let id: String }
        struct ScheduleInsert: Encodable {
            let medication_id: String
            let user_id: String
            let times: [String]
            let dose_qty: Double
            let meal_relation: String
            let reminder_enabled: Bool
            let is_active: Bool
        }
        struct InventoryInsert: Encodable {
            let medication_id: String
            let user_id: String
            let qty_remaining: Double
            let qty_unit: String
            let low_stock_alert: Double
            let expiry_date: String?
            let last_purchased_at: String
            let last_purchased_qty: Double
        }

        let med: MedRow = try await db
            .from("medications")
            .insert(MedInsert(
                user_id: userId, name: name,
                brand_name: brandName?.isEmpty == true ? nil : brandName,
                dosage_form: dosageForm,
                strength: strength?.isEmpty == true ? nil : strength,
                purpose: purpose?.isEmpty == true ? nil : purpose,
                notes: notes?.isEmpty == true ? nil : notes
            ))
            .select("id")
            .single()
            .execute()
            .value

        if !times.isEmpty {
            try await db.from("medication_schedules").insert(ScheduleInsert(
                medication_id: med.id, user_id: userId, times: times, dose_qty: doseQty,
                meal_relation: mealRelation, reminder_enabled: reminderEnabled, is_active: true
            )).execute()
        }
        if qtyTotal > 0 {
            try await db.from("medication_inventory").insert(InventoryInsert(
                medication_id: med.id, user_id: userId, qty_remaining: qtyTotal, qty_unit: qtyUnit,
                low_stock_alert: lowStockAlert, expiry_date: expiryDate?.isEmpty == true ? nil : expiryDate,
                last_purchased_at: todayDateOnlyString(), last_purchased_qty: qtyTotal
            )).execute()
        }

        await load(userId: userId)
    }

    func logMedication(userId: String, medicationId: String, status: String) async throws {
        struct Insert: Encodable {
            let medication_id: String
            let user_id: String
            let status: String
        }
        try await db
            .from("medication_logs")
            .insert(Insert(medication_id: medicationId, user_id: userId, status: status))
            .execute()
        await loadTodayLogs(userId: userId)
    }

    /// Soft-delete — matches web's DELETE /api/liff/medications/[id] exactly
    /// (sets `is_active = false`, never `.delete()`). A hard delete here used
    /// to cascade through medication_schedules/medication_inventory/
    /// medication_logs (all `ON DELETE CASCADE` in 031_medication_tracking.sql),
    /// silently destroying someone's entire dose-taking history the moment
    /// they removed one misspelled entry — the opposite of what web already
    /// chose deliberately, and worse here since there was no confirmation
    /// prompt in front of it either (see HealthView's delete alert).
    func deleteMedication(id: String) async throws {
        struct Patch: Encodable { let is_active: Bool }
        try await db
            .from("medications")
            .update(Patch(is_active: false))
            .eq("id", value: id)
            .execute()
        medications.removeAll { $0.id == id }
        todayLogs.removeAll { $0.medicationId == id }
        syncReminderNotifications()
    }

    /// Edits an existing medication's own fields, and its primary schedule/
    /// inventory rows by id — never re-inserts them, so dose history
    /// (medication_logs, which points at schedule_id) keeps referring to the
    /// same row instead of orphaning against one that no longer exists.
    func updateMedication(
        id: String, scheduleId: String?, inventoryId: String?,
        name: String, brandName: String?, dosageForm: String, notes: String?,
        strength: String?, purpose: String?,
        times: [String], doseQty: Double, mealRelation: String, reminderEnabled: Bool,
        qtyRemaining: Double, qtyUnit: String, lowStockAlert: Double, expiryDate: String?
    ) async throws {
        struct MedPatch: Encodable {
            let name: String
            let brand_name: String?
            let dosage_form: String
            let strength: String?
            let purpose: String?
            let notes: String?
        }
        struct ScheduleInsert: Encodable {
            let medication_id: String
            let user_id: String
            let times: [String]
            let dose_qty: Double
            let meal_relation: String
            let reminder_enabled: Bool
            let is_active: Bool
        }
        struct SchedulePatch: Encodable {
            let times: [String]
            let dose_qty: Double
            let meal_relation: String
            let reminder_enabled: Bool
        }
        struct InventoryInsert: Encodable {
            let medication_id: String
            let user_id: String
            let qty_remaining: Double
            let qty_unit: String
            let low_stock_alert: Double
            let expiry_date: String?
            let last_purchased_at: String
            let last_purchased_qty: Double
        }
        struct InventoryPatch: Encodable {
            let qty_remaining: Double
            let qty_unit: String
            let low_stock_alert: Double
            let expiry_date: String?
        }
        let userId = try await db.auth.session.user.id.uuidString

        try await db.from("medications").update(MedPatch(
            name: name,
            brand_name: brandName?.isEmpty == true ? nil : brandName,
            dosage_form: dosageForm,
            strength: strength?.isEmpty == true ? nil : strength,
            purpose: purpose?.isEmpty == true ? nil : purpose,
            notes: notes?.isEmpty == true ? nil : notes
        )).eq("id", value: id).execute()

        if let scheduleId {
            try await db.from("medication_schedules").update(SchedulePatch(
                times: times, dose_qty: doseQty, meal_relation: mealRelation, reminder_enabled: reminderEnabled
            )).eq("id", value: scheduleId).execute()
        } else if !times.isEmpty {
            try await db.from("medication_schedules").insert(ScheduleInsert(
                medication_id: id, user_id: userId, times: times, dose_qty: doseQty,
                meal_relation: mealRelation, reminder_enabled: reminderEnabled, is_active: true
            )).execute()
        }

        if let inventoryId {
            try await db.from("medication_inventory").update(InventoryPatch(
                qty_remaining: qtyRemaining, qty_unit: qtyUnit, low_stock_alert: lowStockAlert,
                expiry_date: expiryDate?.isEmpty == true ? nil : expiryDate
            )).eq("id", value: inventoryId).execute()
        } else if qtyRemaining > 0 {
            try await db.from("medication_inventory").insert(InventoryInsert(
                medication_id: id, user_id: userId, qty_remaining: qtyRemaining, qty_unit: qtyUnit,
                low_stock_alert: lowStockAlert, expiry_date: expiryDate?.isEmpty == true ? nil : expiryDate,
                last_purchased_at: todayDateOnlyString(), last_purchased_qty: qtyRemaining
            )).execute()
        }

        await load(userId: userId)
    }

    func todayStatus(for medicationId: String) -> String {
        todayLogs.first { $0.medicationId == medicationId }?.status ?? "pending"
    }

    var takenCountToday: Int {
        medications.filter { todayStatus(for: $0.id) == "taken" }.count
    }

    // MARK: - Local notifications
    //
    // Deliberately LOCAL (UNUserNotificationCenter), not a server push —
    // the reminder worker (api/src/services/medication-reminder.ts) only
    // ever sends over LINE; there is no APNs device-token registration or
    // server-side push sending anywhere in this codebase, and standing that
    // up needs an Apple Developer APNs key only the account holder can
    // create. A local, daily-repeating notification scheduled straight from
    // `medication_schedules.times` needs none of that, works with no
    // network at fire time, and is what most medication-reminder apps
    // actually use for this — the server-push path stays what it already
    // is, a LINE-specific delivery channel, not a gap this fills.

    func requestNotificationPermission() async {
        let granted = (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        notificationsAuthorized = granted
        if granted { syncReminderNotifications() }
    }

    func refreshNotificationAuthorization() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        notificationsAuthorized = settings.authorizationStatus == .authorized
    }

    /// Identifier scheme: "med-reminder-{medicationId}-{HH:mm}" — stable
    /// across syncs, so re-running this after every load/edit replaces a
    /// changed time instead of piling up duplicates, and a medication or
    /// time that no longer exists gets removed rather than lingering.
    private func reminderIdentifiers(_ medications: [Medication]) -> [String: (med: Medication, time: String)] {
        var out: [String: (Medication, String)] = [:]
        for med in medications {
            guard let sched = med.primarySchedule, sched.reminderEnabled else { continue }
            for time in sched.times {
                out["med-reminder-\(med.id)-\(time)"] = (med, time)
            }
        }
        return out
    }

    func syncReminderNotifications() {
        guard notificationsAuthorized else { return }
        let center = UNUserNotificationCenter.current()
        let wanted = reminderIdentifiers(medications)

        center.getPendingNotificationRequests { pending in
            let scheduled = Set(pending.map(\.identifier).filter { $0.hasPrefix("med-reminder-") })
            let toRemove = scheduled.subtracting(wanted.keys)
            if !toRemove.isEmpty {
                center.removePendingNotificationRequests(withIdentifiers: Array(toRemove))
            }

            // Only add identifiers not already scheduled — avoids re-adding
            // (and losing any in-flight state for) a reminder that hasn't
            // actually changed since the last sync.
            for (id, (med, time)) in wanted where !scheduled.contains(id) {
                let parts = time.split(separator: ":")
                guard parts.count == 2, let hour = Int(parts[0]), let minute = Int(parts[1]) else { continue }

                let content = UNMutableNotificationContent()
                // Names two similar-sounding drugs apart at a glance, and
                // answers "what/why" — not just "time to take something".
                content.title = "💊 เวลาทานยา — \(med.name)"
                let sched = med.primarySchedule
                let mealText: [String: String] = ["before": "ก่อนอาหาร", "after": "หลังอาหาร", "with": "พร้อมอาหาร", "any": ""]
                let meal = sched?.mealNote ?? mealText[sched?.mealRelation ?? "any"] ?? ""
                var bodyLines = ["\(sched?.doseQty.clean ?? "1") \(med.dosageForm == "liquid" ? "ml" : "เม็ด")" + (meal.isEmpty ? "" : " · \(meal)")]
                if let purpose = med.purpose, !purpose.isEmpty { bodyLines.append("🎯 \(purpose)") }
                content.body = bodyLines.joined(separator: "\n")
                content.sound = .default
                content.userInfo = ["medicationId": med.id]

                var dateComponents = DateComponents()
                dateComponents.hour = hour
                dateComponents.minute = minute
                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)

                center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            }
        }
    }

    // MARK: - Date helpers
    private func todayDateString() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        return f.string(from: Date()) + "T00:00:00+00:00"
    }

    private func tomorrowDateString() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return f.string(from: tomorrow) + "T00:00:00+00:00"
    }

    private func todayDateOnlyString() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        return f.string(from: Date())
    }
}

extension Double {
    /// "2.0" → "2", "1.5" → "1.5" — a dose count reads oddly with a bare decimal point.
    var clean: String {
        truncatingRemainder(dividingBy: 1) == 0 ? String(Int(self)) : String(self)
    }
}
