import Foundation

/// Mirrors the real `documents` table schema (see
/// `supabase/migrations/001_core_schema.sql` + `007_document_schema_v2.sql`).
/// Note: the table has NO `file_name`, `invoice_number`, `subtotal_amount`,
/// `net_amount` or `category` columns — those were mistaken aliases. The real
/// columns are `file_path`, `doc_number`, `subtotal`, `doc_category`.
/// `fileName` below is derived client-side from `file_path` for display only.
struct SlippyDocument: Codable, Identifiable {
    let id: String
    let organizationId: String
    let vendorName: String?
    let invoiceNumber: String?
    let docDate: String?
    let totalAmount: Double?
    let vatAmount: Double?
    let whtAmount: Double?
    let subtotalAmount: Double?
    let status: String
    let source: String
    let docType: String?
    let overallConfidence: Double?
    let category: String?
    let filePath: String
    let createdAt: String

    /// Display-only file name derived from the storage path (no DB column backs this).
    var fileName: String {
        (filePath as NSString).lastPathComponent
    }

    enum CodingKeys: String, CodingKey {
        case id
        case organizationId    = "organization_id"
        case vendorName        = "vendor_name"
        case invoiceNumber     = "doc_number"
        case docDate           = "doc_date"
        case totalAmount       = "total_amount"
        case vatAmount         = "vat_amount"
        case whtAmount         = "wht_amount"
        case subtotalAmount    = "subtotal"
        case status, source
        case docType           = "doc_type"
        case overallConfidence = "overall_confidence"
        case category          = "doc_category"
        case filePath          = "file_path"
        case createdAt         = "created_at"
    }
}

extension SlippyDocument {
    var statusColor: String {
        switch status {
        case "pushed":    return "#8b5cf6"
        case "approved":  return "#10b981"
        case "reviewing": return "#f59e0b"
        case "failed":    return "#ef4444"
        default:          return "#94a3b8"
        }
    }

    var statusLabel: String {
        switch status {
        case "pushed":    return "ส่งแล้ว"
        case "approved":  return "อนุมัติ"
        case "reviewing": return "ตรวจสอบ"
        case "processing":return "ประมวลผล"
        case "failed":    return "ผิดพลาด"
        default:          return "รอดำเนินการ"
        }
    }
}
