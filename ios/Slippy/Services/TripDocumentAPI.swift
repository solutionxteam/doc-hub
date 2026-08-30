import Foundation
import Supabase

/// Reading travel documents and exporting a trip PDF, from the phone.
///
/// These two go through the WEB app rather than Supabase, because they need
/// things that only exist server-side: the vision model that reads a boarding
/// pass, and the headless browser that lays out a PDF. Everything else the trip
/// screens do talks to Supabase directly (see TripItineraryAPI) — participant
/// -scoped RLS means the database can enforce access on its own.
///
/// AUTHENTICATION
/// The user's Supabase access token, as a Bearer. The app must never hold the
/// api service's internal key: it would ship inside the bundle, and a key in a
/// bundle is a published key. The web routes accept either a cookie or a Bearer
/// (web/src/lib/authed-user.ts), which is what makes this possible.
enum TripDocumentAPI {

    /// The web app. Overridable so a build can point at a staging deployment.
    /// Falls back to Config.webAppURL — NOT a hardcoded literal. This used to
    /// hardcode "https://app.slippy.app" here, which is dead (NXDOMAIN, never
    /// actually provisioned in DNS): every call to read/scanReceipt/export
    /// without WEB_BASE_URL set was silently failing with a DNS error on a
    /// real device/simulator, only ever masked because this had only been
    /// build-verified, not exercised end-to-end from the phone.
    private static let base: String = {
        ProcessInfo.processInfo.environment["WEB_BASE_URL"] ?? Config.webAppURL.absoluteString
    }()

    enum APIError: LocalizedError {
        case notSignedIn
        case server(String)
        case badResponse

        var errorDescription: String? {
            switch self {
            case .notSignedIn:      return "กรุณาเข้าสู่ระบบใหม่"
            case .server(let m):    return m
            case .badResponse:      return "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง"
            }
        }
    }

    private static func accessToken() async throws -> String {
        guard let token = try? await SupabaseManager.shared.client.auth.session.accessToken else {
            throw APIError.notSignedIn
        }
        return token
    }

    // MARK: – Reading a travel document

    /// One entry the reader proposes. Nothing is written until the user accepts.
    struct Proposed: Codable, Identifiable, Hashable {
        var id: String { "\(type)-\(title)-\(date ?? "")-\(timeFrom ?? "")" }
        let type: String
        let title: String
        let subtitle: String?
        let date: String?
        let timeFrom: String?
        let timeTo: String?
        let location: String?
        let endLocation: String?
        let provider: String?
        let confirmationCode: String?
        let amount: Double?
        let currency: String?
        let notes: String?
        let confidence: Double

        enum CodingKeys: String, CodingKey {
            case type, title, subtitle, date, location, provider, amount, currency, notes, confidence
            case timeFrom = "time_from"
            case timeTo = "time_to"
            case endLocation = "end_location"
            case confirmationCode = "confirmation_code"
        }
    }

    struct TripDay: Codable, Hashable {
        let dayNumber: Int
        let date: String?
        let city: String?
        enum CodingKeys: String, CodingKey {
            case date, city
            case dayNumber = "day_number"
        }
    }

    struct ReadResult: Codable {
        let documentKind: String
        let items: [Proposed]
        let issues: [String]
        let pagesRead: Int
        let tripDays: [TripDay]

        enum CodingKeys: String, CodingKey {
            case items, issues
            case documentKind = "document_kind"
            case pagesRead = "pages_read"
            case tripDays
        }
    }

    /// Uploads a file and gets back PROPOSED entries. Writes nothing.
    static func read(tripId: String, fileData: Data, fileName: String, mimeType: String) async throws -> ReadResult {
        guard let url = URL(string: "\(base)/api/trips/\(tripId)/import-document") else {
            throw APIError.badResponse
        }
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        req.httpBody = body
        // Vision over a multi-page PDF is not fast, and the default 60s would
        // report a network failure for a service that is working.
        req.timeoutInterval = 150

        let (data, response) = try await URLSession.shared.data(for: req)
        try throwIfError(data: data, response: response)
        return try JSONDecoder().decode(ReadResult.self, from: data)
    }

    struct AcceptResult: Codable {
        let created: Int
        let skipped: [String]
    }

    /// Writes the entries the user ticked.
    static func accept(tripId: String, items: [Proposed]) async throws -> AcceptResult {
        guard let url = URL(string: "\(base)/api/trips/\(tripId)/import-document") else {
            throw APIError.badResponse
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(["accept": items])
        req.timeoutInterval = 60

        let (data, response) = try await URLSession.shared.data(for: req)
        try throwIfError(data: data, response: response)
        return try JSONDecoder().decode(AcceptResult.self, from: data)
    }

    // MARK: – Scanning a receipt into an expense

    struct ScannedLine: Codable, Identifiable {
        var id: String { "\(description)-\(amount)" }
        let description: String
        let quantity: Double?
        let unitPrice: Double?
        let amount: Double

        enum CodingKeys: String, CodingKey {
            case description, quantity, amount
            case unitPrice = "unit_price"
        }
    }

    struct ScannedReceipt: Codable {
        let documentId: String
        let vendorName: String?
        let total: Double?
        let currency: String
        let date: String?
        let confidence: Double?
        /// What the reader could not resolve cleanly — shown, never hidden.
        let issues: [String]
        let items: [ScannedLine]
    }

    /// Reads a receipt through the SAME pipeline the accounting side uses, and
    /// returns what it found. Writes no expense — the user checks it first.
    static func scanReceipt(tripId: String, imageData: Data, fileName: String, mimeType: String) async throws -> ScannedReceipt {
        guard let url = URL(string: "\(base)/api/trips/\(tripId)/expenses/scan") else {
            throw APIError.badResponse
        }
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        req.httpBody = body
        // Extraction on a dense receipt takes a while; the default would report
        // a network failure for a service that is working.
        req.timeoutInterval = 180

        let (data, response) = try await URLSession.shared.data(for: req)
        try throwIfError(data: data, response: response)
        return try JSONDecoder().decode(ScannedReceipt.self, from: data)
    }

    // MARK: – PDF

    /// Renders the trip document and writes it to a temporary file.
    ///
    /// Returns a file URL rather than Data because that is what a share sheet
    /// and Files both want, and it keeps a multi-megabyte document out of memory
    /// while the user decides what to do with it.
    static func exportPDF(tripId: String, tripTitle: String) async throws -> URL {
        guard let url = URL(string: "\(base)/api/trips/\(tripId)/pdf") else {
            throw APIError.badResponse
        }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 90

        let (data, response) = try await URLSession.shared.data(for: req)
        try throwIfError(data: data, response: response)

        // Named after the trip so the share sheet and Files show something
        // recognisable instead of a UUID.
        let safe = tripTitle.components(separatedBy: CharacterSet(charactersIn: "/\\?%*:|\"<>"))
            .joined(separator: "-")
        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(safe).pdf")
        try data.write(to: dest, options: .atomic)
        return dest
    }

    // MARK: – Google Maps (KML)

    /// The trip as a .kml file, for Google My Maps — no waypoint limit, unlike
    /// a Google Maps directions link (see GoogleMapsLinks). Import it at
    /// mymaps.google.com (works from a phone browser) and it becomes a saved
    /// map, visible afterward in the Google Maps app under Saved → Maps.
    static func exportKML(tripId: String, tripTitle: String) async throws -> URL {
        guard let url = URL(string: "\(base)/api/trips/\(tripId)/kml") else {
            throw APIError.badResponse
        }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: req)
        try throwIfError(data: data, response: response)

        let safe = tripTitle.components(separatedBy: CharacterSet(charactersIn: "/\\?%*:|\"<>"))
            .joined(separator: "-")
        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(safe).kml")
        try data.write(to: dest, options: .atomic)
        return dest
    }

    // MARK: – Errors

    /// Surfaces the server's own message rather than a status code.
    ///
    /// These endpoints answer in Thai and say useful things ("ทริปนี้ยังไม่มีวัน",
    /// "ไฟล์ใหญ่เกินไป"). Replacing that with "request failed (400)" throws away
    /// the only part the user can act on.
    private static func throwIfError(data: Data, response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.badResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError.server(message ?? "ทำรายการไม่สำเร็จ (\(http.statusCode))")
        }
    }
}
