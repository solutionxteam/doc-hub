import SwiftUI
import Supabase

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var session: Session?
    @Published var profile: UserProfile?
    @Published var membership: OrganizationMember?
    @Published var isLoading = true
    @Published var error: String?

    private let db = SupabaseManager.shared.client

    init() {
        Task { await listenForAuthChanges() }
    }

    // MARK: – Auth State Listener
    private func listenForAuthChanges() async {
        for await state in db.auth.authStateChanges {
            switch state.event {
            case .initialSession, .signedIn:
                self.session = state.session
                if state.session != nil {
                    await loadUserData()
                }
            case .signedOut:
                self.session   = nil
                self.profile   = nil
                self.membership = nil
            default:
                break
            }
            self.isLoading = false
        }
    }

    private func loadUserData() async {
        async let profileTask    = fetchProfile()
        async let membershipTask = fetchMembership()
        _ = await (profileTask, membershipTask)
    }

    // MARK: – Sign In / Out
    func signIn(email: String, password: String) async {
        error = nil
        do {
            try await db.auth.signIn(email: email.trimmingCharacters(in: .whitespaces),
                                     password: password)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func signOut() async {
        do {
            try await db.auth.signOut()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: – Fetch helpers
    private func fetchProfile() async {
        guard let userId = session?.user.id.uuidString else { return }
        do {
            profile = try await db
                .from("users")
                .select()
                .eq("id", value: userId)
                .single()
                .execute()
                .value
        } catch { print("[Auth] Profile error:", error) }
    }

    private func fetchMembership() async {
        guard let userId = session?.user.id.uuidString else { return }
        do {
            membership = try await db
                .from("organization_members")
                .select("*, organizations(*)")
                .eq("user_id", value: userId)
                .single()
                .execute()
                .value
        } catch { print("[Auth] Membership error:", error) }
    }

    var org: Organization? { membership?.organizations }
    var isSignedIn: Bool { session != nil && !isLoading }
}
