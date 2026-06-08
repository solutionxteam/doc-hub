import SwiftUI
import Supabase

/// Reads/writes the same `vendors` table the web app uses
/// (`web/src/app/(app)/vendors/page.tsx` + `vendors-client.tsx`),
/// keeping both platforms on one source of truth.
@MainActor
final class VendorsViewModel: ObservableObject {
    @Published var vendors: [Vendor] = []
    @Published var searchText = ""
    @Published var selectedCategory = "all"
    @Published var isLoading = false
    @Published var error: String?

    private let db = SupabaseManager.shared.client
    private var orgId = ""

    var filtered: [Vendor] {
        vendors.filter { v in
            let matchesCategory = selectedCategory == "all" || v.category == selectedCategory
            let matchesSearch = searchText.isEmpty
                || v.name.localizedCaseInsensitiveContains(searchText)
                || (v.taxId ?? "").localizedCaseInsensitiveContains(searchText)
            return matchesCategory && matchesSearch
        }
    }

    func load(orgId: String) async {
        self.orgId = orgId
        isLoading = true
        defer { isLoading = false }
        do {
            vendors = try await db
                .from("vendors")
                .select()
                .eq("organization_id", value: orgId)
                .order("total_amount", ascending: false)
                .limit(200)
                .execute()
                .value
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Mirrors the web `EditVendorModal`'s save() — direct update on `vendors`.
    func update(vendor: Vendor, name: String, taxId: String, address: String,
                phone: String, category: String) async -> Bool {
        do {
            struct Patch: Encodable {
                let name: String
                let tax_id: String?
                let address: String?
                let phone: String?
                let category: String?
            }
            let patch = Patch(
                name: name.trimmingCharacters(in: .whitespaces).isEmpty ? vendor.name : name,
                tax_id: taxId.trimmingCharacters(in: .whitespaces).isEmpty ? nil : taxId,
                address: address.trimmingCharacters(in: .whitespaces).isEmpty ? nil : address,
                phone: phone.trimmingCharacters(in: .whitespaces).isEmpty ? nil : phone,
                category: category.isEmpty ? nil : category
            )
            let updated: Vendor = try await db
                .from("vendors")
                .update(patch)
                .eq("id", value: vendor.id)
                .select()
                .single()
                .execute()
                .value
            if let idx = vendors.firstIndex(where: { $0.id == vendor.id }) {
                vendors[idx] = updated
            }
            hapticSuccess()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}
