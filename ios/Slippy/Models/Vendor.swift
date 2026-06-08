import Foundation

/// Mirrors the web app's `vendors` table — same backend, same fields
/// (see `web/src/components/vendors/vendors-client.tsx` → `interface Vendor`).
struct Vendor: Codable, Identifiable {
    let id: String
    let organizationId: String?
    let name: String
    let taxId: String?
    let address: String?
    let phone: String?
    let category: String?
    let lat: Double?
    let lng: Double?
    let docCount: Int?
    let totalAmount: Double?
    let vatTotal: Double?
    let lastDocDate: String?

    enum CodingKeys: String, CodingKey {
        case id
        case organizationId = "organization_id"
        case name
        case taxId          = "tax_id"
        case address, phone, category, lat, lng
        case docCount       = "doc_count"
        case totalAmount    = "total_amount"
        case vatTotal       = "vat_total"
        case lastDocDate    = "last_doc_date"
    }
}

extension Vendor {
    /// Mirrors `getThumb()` in the web vendors client — brand-name → emoji lookup.
    var thumbEmoji: String {
        let l = name.lowercased()
        let map: [(String, String)] = [
            ("grab", "🚖"), ("line man", "🛵"), ("lineman", "🛵"),
            ("foodpanda", "🛵"), ("robinhood", "🛵"), ("shopee", "🛍️"),
            ("lazada", "🛍️"), ("amazon", "☁️"), ("aws", "☁️"),
            ("google", "☁️"), ("microsoft", "☁️"), ("azure", "☁️"),
            ("7-eleven", "🧾"), ("7eleven", "🧾"), ("makro", "🛒"),
            ("lotus", "🛒"), ("big c", "🛒"), ("homepro", "🔨"),
            ("shell", "⛽"), ("ptt", "⛽"), ("bangchak", "⛽"),
            ("esso", "⛽"), ("caltex", "⛽"), ("ais", "📶"),
            ("true", "📶"), ("dtac", "📶"), ("mea", "💡"),
            ("pea", "💡"), ("mwa", "💧"), ("starbucks", "☕"),
            ("figma", "🎨"), ("slack", "🎨"), ("notion", "🎨"),
        ]
        for (k, e) in map where l.contains(k) { return e }
        return "🏢"
    }

    /// Mirrors `catLabel()`/`CATEGORIES` in the web vendors client.
    static let categories: [(id: String, label: String, emoji: String)] = [
        ("all",        "ทั้งหมด",                "📋"),
        ("food",       "อาหาร & เครื่องดื่ม",     "🍽️"),
        ("transport",  "การเดินทาง",             "🚖"),
        ("utilities",  "สาธารณูปโภค",            "💡"),
        ("software",   "ซอฟต์แวร์ & Cloud",      "☁️"),
        ("retail",     "ค้าปลีก",                "🛒"),
        ("health",     "สุขภาพ",                 "🏥"),
        ("office",     "สำนักงาน",               "🏢"),
        ("fuel",       "น้ำมัน & พลังงาน",        "⛽"),
        ("telecom",    "โทรคมนาคม",              "📶"),
        ("other",      "อื่นๆ",                   "📦"),
    ]

    var categoryLabel: String {
        Vendor.categories.first(where: { $0.id == category })?.label ?? (category ?? "อื่นๆ")
    }
    var categoryEmoji: String {
        Vendor.categories.first(where: { $0.id == category })?.emoji ?? "📦"
    }

    /// Mirrors `brandColor()` — deterministic hash → palette color (hex string).
    var brandColorHex: String {
        var h: Int32 = 0
        for ch in name.unicodeScalars { h = (h &* 31 &+ Int32(ch.value)) }
        let palette = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#84cc16","#6366f1"]
        let idx = Int(abs(Int(h))) % palette.count
        return palette[idx]
    }
}
