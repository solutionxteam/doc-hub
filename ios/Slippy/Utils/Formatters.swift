import Foundation

// MARK: – Thai Baht Formatter
func fmtTHB(_ amount: Double, decimals: Int = 0) -> String {
    let fmt = NumberFormatter()
    fmt.numberStyle          = .decimal
    fmt.minimumFractionDigits = decimals
    fmt.maximumFractionDigits = decimals
    fmt.groupingSeparator    = ","
    let formatted = fmt.string(from: NSNumber(value: amount)) ?? "0"
    return "฿\(formatted)"
}

// MARK: – Relative Time (Thai)
func relTime(_ isoString: String) -> String {
    let fmt = ISO8601DateFormatter()
    fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = fmt.date(from: isoString) else { return "" }
    let diff = Date().timeIntervalSince(date)
    switch diff {
    case ..<60:          return "เมื่อกี้"
    case ..<3600:        return "\(Int(diff/60)) นาทีที่แล้ว"
    case ..<86400:       return "\(Int(diff/3600)) ชม.ที่แล้ว"
    case ..<604800:      return "\(Int(diff/86400)) วันที่แล้ว"
    default:             return fmtDate(isoString)
    }
}

// MARK: – Thai Date Formatter
func fmtDate(_ isoString: String) -> String {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = iso.date(from: isoString) else { return isoString }
    let fmt = DateFormatter()
    fmt.locale     = Locale(identifier: "th_TH")
    fmt.dateStyle  = .medium
    fmt.timeStyle  = .none
    return fmt.string(from: date)
}

// MARK: – VAT Calculation (Thai 7% inclusive)
struct VATResult {
    let vat: Double
    let net: Double
}

func calcVAT(_ total: Double) -> VATResult {
    let vat = (total * 700.0 / 107.0).rounded() / 100.0
    let net = (total * 100.0).rounded() / 100.0 - vat
    return VATResult(vat: vat, net: net)
}
