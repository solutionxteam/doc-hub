import Foundation

struct Organization: Codable, Identifiable {
    let id: String
    let name: String
    let plan: String
    let docQuota: Int
    let docUsed: Int

    enum CodingKeys: String, CodingKey {
        case id, name, plan
        case docQuota = "doc_quota"
        case docUsed  = "doc_used"
    }

    var quotaPercent: Double {
        guard docQuota > 0 else { return 0 }
        return Double(docUsed) / Double(docQuota)
    }
}

struct OrganizationMember: Codable {
    let id: String
    let userId: String
    let role: String
    let joinedAt: String
    let organizations: Organization

    enum CodingKeys: String, CodingKey {
        case id
        case userId   = "user_id"
        case role
        case joinedAt = "joined_at"
        case organizations
    }
}

struct MonthSummary: Codable, Identifiable {
    let id: String
    let organizationId: String
    let month: String
    let docCount: Int
    let grandTotal: Double
    let vatTotal: Double

    enum CodingKeys: String, CodingKey {
        case id
        case organizationId = "organization_id"
        case month
        case docCount   = "doc_count"
        case grandTotal = "grand_total"
        case vatTotal   = "vat_total"
    }
}
