import Foundation

struct SlippyDocument: Codable, Identifiable {
    let id: String
    let organizationId: String
    let vendorName: String?
    let invoiceNumber: String?
    let docDate: String?
    let totalAmount: Double?
    let vatAmount: Double?
    let netAmount: Double?
    let status: String
    let source: String
    let docType: String?
    let overallConfidence: Double?
    let category: String?
    let fileName: String
    let filePath: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case organizationId    = "organization_id"
        case vendorName        = "vendor_name"
        case invoiceNumber     = "invoice_number"
        case docDate           = "doc_date"
        case totalAmount       = "total_amount"
        case vatAmount         = "vat_amount"
        case netAmount         = "net_amount"
        case status, source
        case docType           = "doc_type"
        case overallConfidence = "overall_confidence"
        case category
        case fileName          = "file_name"
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
