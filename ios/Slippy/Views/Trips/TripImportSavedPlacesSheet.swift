import SwiftUI
import CoreLocation
import UniformTypeIdentifiers
import Supabase

/// Import places from a Google Maps "Saved Places" export — pick, review, file.
///
/// WHY A FILE, NOT A LOGIN
/// Google has no API for a third-party app to read a signed-in user's personal
/// Saved Places list — that list lives inside the Google account and the Google
/// Maps app only. The one real way to get it out is the file Google itself
/// produces: Google Takeout ("Maps (your places)" → Saved Places.json, a
/// GeoJSON FeatureCollection), or the .kml a single list exports as from
/// Google Maps' web "Your lists" page. Both are supported here; the same
/// review-before-write discipline as TripImportDocumentSheet applies — nothing
/// is written until the user ticks it.
struct TripImportSavedPlacesSheet: View {
    let days: [TripItineraryDay]
    let defaultDay: TripItineraryDay
    let baseCurrency: String
    let onDone: (Bool) -> Void

    @State private var showFileImporter = false
    @State private var reading = false
    @State private var saving = false
    @State private var places: [ImportedPlace] = []
    @State private var picked: Set<ImportedPlace.ID> = []
    @State private var targetDayId: String
    @State private var fileName = ""
    @State private var errorText: String?
    @Environment(\.dismiss) private var dismiss

    init(days: [TripItineraryDay], defaultDay: TripItineraryDay, baseCurrency: String, onDone: @escaping (Bool) -> Void) {
        self.days = days
        self.defaultDay = defaultDay
        self.baseCurrency = baseCurrency
        self.onDone = onDone
        _targetDayId = State(initialValue: defaultDay.id)
    }

    struct ImportedPlace: Identifiable {
        let id = UUID()
        let title: String
        let address: String?
        let mapsURL: String?
        let coordinate: CLLocationCoordinate2D
    }

    var body: some View {
        NavigationStack {
            Group {
                if places.isEmpty {
                    picker
                } else {
                    reviewList
                }
            }
            .navigationTitle("นำเข้าจาก Google Maps")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ปิด") { onDone(false); dismiss() }
                }
                if !places.isEmpty {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(saving ? "กำลังเพิ่ม…" : "เพิ่ม (\(picked.count))") {
                            Task { await save() }
                        }
                        .disabled(picked.isEmpty || saving)
                    }
                }
            }
            .alert("ไม่สำเร็จ", isPresented: .constant(errorText != nil)) {
                Button("ตกลง") { errorText = nil }
            } message: { Text(errorText ?? "") }
            .fileImporter(
                isPresented: $showFileImporter,
                allowedContentTypes: [.json, UTType(filenameExtension: "kml") ?? .xml],
                onCompletion: handlePick
            )
        }
    }

    // MARK: – Pick

    private var picker: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 44))
                .foregroundColor(Color.brand500)
            Text("นำเข้าไฟล์ที่ Google Maps ส่งออกให้ — Saved Places.json จาก Google Takeout หรือไฟล์ .kml ของลิสต์ใดลิสต์หนึ่ง")
                .font(.system(size: 13))
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Text("Google ไม่มีทางให้แอปอื่นดึงลิสต์ที่บันทึกไว้แบบสดๆ ต้องส่งออกเป็นไฟล์ก่อน")
                .font(.system(size: 11))
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            if reading {
                ProgressView("กำลังอ่าน \(fileName)…").padding(.top, 10)
            } else {
                Button {
                    showFileImporter = true
                } label: {
                    Label("เลือกไฟล์", systemImage: "doc")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal, 40)
                .padding(.top, 8)
            }
            Spacer()
        }
    }

    // MARK: – Review

    private var reviewList: some View {
        List {
            Section {
                Picker("ใส่ไว้วันที่", selection: $targetDayId) {
                    ForEach(days) { day in
                        Text("วันที่ \(day.dayNumber)\(day.city.map { " · \($0)" } ?? "")").tag(day.id)
                    }
                }
                HStack {
                    Text("\(fileName) · พบ \(places.count) สถานที่")
                        .font(.system(size: 11)).foregroundColor(Color.textSecondary)
                    Spacer()
                    Button("เปลี่ยนไฟล์") { places = []; picked = [] }
                        .font(.system(size: 12, weight: .semibold))
                }
            }

            Section("เลือกสถานที่ที่จะเพิ่ม") {
                ForEach(places) { place in
                    row(place)
                }
            }
        }
    }

    private func row(_ place: ImportedPlace) -> some View {
        let on = picked.contains(place.id)
        return Button {
            hapticLight()
            if on { picked.remove(place.id) } else { picked.insert(place.id) }
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: on ? "checkmark.square.fill" : "square")
                    .foregroundColor(on ? Color.brand500 : Color.textSecondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(place.title).font(.system(size: 13, weight: .semibold)).foregroundColor(Color.textPrimary)
                    if let address = place.address {
                        Text(address).font(.system(size: 11)).foregroundColor(Color.textSecondary).lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: – Import

    private func handlePick(_ result: Result<URL, Error>) {
        switch result {
        case .failure(let error):
            errorText = error.localizedDescription
        case .success(let url):
            guard url.startAccessingSecurityScopedResource() else {
                errorText = "เปิดไฟล์ไม่ได้"; return
            }
            defer { url.stopAccessingSecurityScopedResource() }
            guard let data = try? Data(contentsOf: url) else {
                errorText = "อ่านไฟล์ไม่ได้"; return
            }
            fileName = url.lastPathComponent
            reading = true
            let isKML = url.pathExtension.lowercased() == "kml"
            let parsed = isKML ? SavedPlacesParser.parseKML(data) : SavedPlacesParser.parseGeoJSON(data)
            reading = false
            if parsed.isEmpty {
                errorText = "ไม่พบสถานที่ในไฟล์นี้ — ตรวจสอบว่าเป็นไฟล์ Saved Places.json จาก Google Takeout หรือไฟล์ .kml ที่ส่งออกจากลิสต์"
                return
            }
            places = parsed
            picked = Set(parsed.map(\.id))
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        guard let day = days.first(where: { $0.id == targetDayId }) else { return }
        var failed = 0
        for place in places where picked.contains(place.id) {
            var details: [String: AnyJSON] = [:]
            if let address = place.address, !address.isEmpty { details["address"] = .string(address) }
            if let mapsURL = place.mapsURL, !mapsURL.isEmpty { details["website"] = .string(mapsURL) }
            do {
                _ = try await TripItineraryAPI.addStop(
                    dayId: day.id,
                    title: place.title,
                    type: "other",
                    lat: place.coordinate.latitude,
                    lng: place.coordinate.longitude,
                    location: place.address,
                    timeFrom: nil,
                    baseCurrency: baseCurrency,
                    details: details
                )
            } catch {
                failed += 1
            }
        }
        if failed > 0 {
            errorText = "เพิ่มไม่สำเร็จ \(failed) รายการ — ลองใหม่อีกครั้ง"
        } else {
            hapticSuccess()
            onDone(true)
            dismiss()
        }
    }
}

/// Parses the two file shapes Google Maps actually hands back to a user who
/// wants their saved places out: Takeout's GeoJSON, and a list's own .kml
/// export. Both are read defensively — neither is a documented, versioned
/// API, so a missing or renamed field is expected, not exceptional.
private enum SavedPlacesParser {

    /// Google Takeout → Maps (your places) → Saved Places.json.
    /// A `FeatureCollection` whose `properties.Location` carries the name and
    /// address under keys that vary by place type ("Business Name" for a
    /// business, "Name" for a plain pin) — every lookup here has a fallback
    /// for exactly that reason.
    static func parseGeoJSON(_ data: Data) -> [TripImportSavedPlacesSheet.ImportedPlace] {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let features = root["features"] as? [[String: Any]] else { return [] }

        return features.compactMap { feature -> TripImportSavedPlacesSheet.ImportedPlace? in
            guard let geometry = feature["geometry"] as? [String: Any],
                  let coords = geometry["coordinates"] as? [Double], coords.count >= 2 else { return nil }
            // GeoJSON order is [lng, lat], the opposite of everywhere else in
            // this codebase — easy to invert by accident, so named right here.
            let lng = coords[0], lat = coords[1]

            let properties = feature["properties"] as? [String: Any]
            let location = properties?["Location"] as? [String: Any]
            let title = (location?["Business Name"] as? String)
                ?? (location?["Name"] as? String)
                ?? (properties?["Title"] as? String)
                ?? (location?["Address"] as? String)
                ?? "สถานที่ที่บันทึกไว้"
            let address = location?["Address"] as? String
            let mapsURL = properties?["Google Maps URL"] as? String

            return .init(title: title, address: address, mapsURL: mapsURL,
                         coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng))
        }
    }

    /// A single list exported as .kml from Google Maps' "Your lists" page —
    /// one `<Placemark>` per saved place.
    static func parseKML(_ data: Data) -> [TripImportSavedPlacesSheet.ImportedPlace] {
        let delegate = KMLParserDelegate()
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        parser.parse()
        return delegate.places
    }
}

/// Walks `<Placemark><name>…</name><description>…</description>
/// <Point><coordinates>lng,lat[,alt]</coordinates></Point></Placemark>` —
/// the shape every Google Maps list KML export uses. No external XML
/// dependency: `XMLParser` is Foundation's own SAX parser.
private final class KMLParserDelegate: NSObject, XMLParserDelegate {
    private(set) var places: [TripImportSavedPlacesSheet.ImportedPlace] = []

    private var inPlacemark = false
    private var currentElement = ""
    // Not named `description` — that overrides NSObject's own read-only
    // `description` property (this class subclasses NSObject for
    // XMLParserDelegate) and fails to compile with an "ambiguous use" error.
    private var name = "", placeDescription = "", coordinatesText = ""

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?, attributes: [String: String] = [:]) {
        currentElement = elementName
        if elementName == "Placemark" {
            inPlacemark = true
            name = ""; placeDescription = ""; coordinatesText = ""
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        guard inPlacemark else { return }
        switch currentElement {
        case "name": name += string
        case "description": placeDescription += string
        case "coordinates": coordinatesText += string
        default: break
        }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?) {
        guard elementName == "Placemark" else { return }
        inPlacemark = false
        let parts = coordinatesText.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: ",")
        guard parts.count >= 2, let lng = Double(parts[0]), let lat = Double(parts[1]) else { return }
        let title = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let desc = placeDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        places.append(.init(
            title: title.isEmpty ? "สถานที่ที่บันทึกไว้" : title,
            address: desc.isEmpty ? nil : desc,
            mapsURL: nil,
            coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)
        ))
    }
}
