import SwiftUI

/// One reminder schedule for a medication — matches web's `medication_schedules`
/// row shape exactly (web/src/app/api/medications/route.ts), so a schedule
/// created from either surface reads correctly on the other.
struct MedicationSchedule: Codable {
    let id: String
    let times: [String]           // "08:00", "14:00", ...
    let doseQty: Double
    let mealRelation: String      // before | after | with | any
    let mealNote: String?
    let reminderEnabled: Bool

    enum CodingKeys: String, CodingKey {
        case id, times
        case doseQty = "dose_qty"
        case mealRelation = "meal_relation"
        case mealNote = "meal_note"
        case reminderEnabled = "reminder_enabled"
    }
}

/// Stock on hand for a medication — matches `medication_inventory`.
struct MedicationInventory: Codable {
    let qtyRemaining: Double
    let qtyUnit: String
    let lowStockAlert: Double
    let expiryDate: String?

    enum CodingKeys: String, CodingKey {
        case qtyRemaining = "qty_remaining"
        case qtyUnit = "qty_unit"
        case lowStockAlert = "low_stock_alert"
        case expiryDate = "expiry_date"
    }

    /// Days of stock left, at the actual consumption rate — not the fixed
    /// low_stock_alert threshold. Nil when there is no schedule to compute a
    /// daily rate from (an as-needed medication has nothing to divide by).
    func daysRemaining(schedule: MedicationSchedule?) -> Int? {
        guard let schedule, !schedule.times.isEmpty else { return nil }
        let perDay = schedule.doseQty * Double(schedule.times.count)
        guard perDay > 0 else { return nil }
        return Int(qtyRemaining / perDay)
    }
}

struct Medication: Codable, Identifiable {
    let id: String
    let userId: String
    let name: String
    let brandName: String?
    let genericName: String?
    let dosageForm: String
    /// What the drug is for — surfaced in the reminder notification body so
    /// it answers "what/why", not just "time to take something named X".
    let purpose: String?
    let color: String?
    let notes: String?
    let createdAt: String
    let schedules: [MedicationSchedule]
    // PostgREST always returns a to-many embed as an ARRAY — there is no
    // UNIQUE constraint on medication_inventory.medication_id for it to infer
    // a to-one relation from, same reason medication_schedules is an array.
    // A singular `MedicationInventory?` here throws a DecodingError the
    // moment any medication actually has an inventory row (a JSON array
    // token where Codable expects an object-or-null), which silently broke
    // the whole medications list on the phone. See the identical fix on web
    // (medications-client.tsx's own comment on this).
    let inventoryRows: [MedicationInventory]

    enum CodingKeys: String, CodingKey {
        case id, name, notes, purpose, color
        case userId = "user_id"
        case brandName = "brand_name"
        case genericName = "generic_name"
        case dosageForm = "dosage_form"
        case createdAt = "created_at"
        case schedules = "medication_schedules"
        case inventoryRows = "medication_inventory"
    }

    var inventory: MedicationInventory? { inventoryRows.first }

    var dosageFormLabel: String {
        switch dosageForm {
        case "tablet":    return "💊 เม็ด"
        case "capsule":   return "💊 แคปซูล"
        case "liquid":    return "🧴 น้ำ"
        case "inhaler":   return "💨 พ่น"
        case "injection": return "💉 ฉีด"
        case "patch":     return "🩹 แผ่นแปะ"
        case "cream":     return "🧴 ครีม"
        default:          return "💊 อื่นๆ"
        }
    }

    /// The active schedule this card reminds/estimates from — a medication
    /// can only usefully show one at a time, same simplification the web
    /// card already makes (`med.medication_schedules[0]`).
    var primarySchedule: MedicationSchedule? { schedules.first }
}

struct MedicationLog: Codable, Identifiable {
    let id: String
    let medicationId: String
    let userId: String
    let status: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, status
        case medicationId = "medication_id"
        case userId = "user_id"
        case createdAt = "created_at"
    }

    var statusLabel: String {
        switch status {
        case "taken":   return "ทานแล้ว ✅"
        case "missed":  return "ลืมทาน ❌"
        case "skipped": return "ข้าม ⏭️"
        default:        return "รอทาน ⏳"
        }
    }

    var statusColor: Color {
        switch status {
        case "taken":   return .green
        case "missed":  return .red
        case "skipped": return .orange
        default:        return .gray
        }
    }
}

/// What POST /api/medications/scan proposes, read from a photo of a label —
/// mirrors web's ScannedMedication (medications-client.tsx) and the pipeline's
/// own ProposedMedication (api/src/pipeline/medication-label.ts) field for
/// field. Read-only: nothing here is written until AddMedicationView's
/// existing review form is saved, same discipline as every other scan flow
/// in this app (TripDocumentAPI.Proposed, ScannedReceipt).
struct ScannedMedication: Codable {
    let name: String
    let brandName: String?
    let genericName: String?
    let dosageForm: String
    let strength: String?
    let purpose: String?
    let instructionsVerbatim: String?
    let times: [String]
    let doseQty: Double
    let mealRelation: String
    let mealNote: String?
    let qtyTotal: Double?
    let qtyUnit: String
    let expiryDate: String?
    let prescribingDoctor: String?
    let hospitalName: String?
    let lotNo: String?
    let confidence: Double

    enum CodingKeys: String, CodingKey {
        case name, times, strength, purpose, confidence
        case brandName = "brand_name"
        case genericName = "generic_name"
        case dosageForm = "dosage_form"
        case instructionsVerbatim = "instructions_verbatim"
        case doseQty = "dose_qty"
        case mealRelation = "meal_relation"
        case mealNote = "meal_note"
        case qtyTotal = "qty_total"
        case qtyUnit = "qty_unit"
        case expiryDate = "expiry_date"
        case prescribingDoctor = "prescribing_doctor"
        case hospitalName = "hospital_name"
        case lotNo = "lot_no"
    }
}
