import SwiftUI
import Supabase
import AuthenticationServices

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var session: Session?
    @Published var profile: UserProfile?
    @Published var membership: OrganizationMember?
    /// All organizations the user belongs to — mirrors the list `getMembership()`
    /// chooses from on web (`organization_members` rows for this user).
    @Published var memberships: [OrganizationMember] = []
    @Published var isLoading = true
    @Published var error: String?

    /// Active-org selection persisted locally — the mobile equivalent of the
    /// web's `active-org` httpOnly cookie (each platform/client keeps its own).
    private static let activeOrgKey = "slippy.activeOrgId"

    private let db = SupabaseManager.shared.client

    init() {
        Task { await listenForAuthChanges() }
    }

    // MARK: – Auth State Listener
    private func listenForAuthChanges() async {
        for await state in db.auth.authStateChanges {
            switch state.event {
            case .initialSession, .signedIn:
                self.session   = state.session
                self.isLoading = false          // ✅ unblock navigation immediately
                if state.session != nil {
                    Task { await loadUserData() } // load profile/org in background
                }
            case .signedOut:
                self.session    = nil
                self.profile    = nil
                self.membership = nil
                self.isLoading  = false
            default:
                self.isLoading = false
            }
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

    // MARK: – OAuth (Google / Facebook / LINE)
    /// Opens an ASWebAuthenticationSession for the given provider.
    func signInWithOAuth(provider: Provider) async {
        error = nil
        do {
            // 1. Build the provider OAuth URL
            let redirectURL = URL(string: "slippy://auth/callback")!
            let oauthURL = try db.auth.getOAuthSignInURL(
                provider: provider,
                scopes: nil,
                redirectTo: redirectURL,
                queryParams: []
            )

            // 2. Open browser session and wait for redirect
            let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
                DispatchQueue.main.async {
                    let session = ASWebAuthenticationSession(
                        url: oauthURL,
                        callbackURLScheme: "slippy"
                    ) { url, sessionError in
                        if let url {
                            continuation.resume(returning: url)
                        } else {
                            continuation.resume(throwing: sessionError ?? URLError(.cancelled))
                        }
                    }
                    session.prefersEphemeralWebBrowserSession = false
                    session.presentationContextProvider = PresentationContextProvider.shared
                    session.start()
                    // Retain session so it isn't deallocated
                    PresentationContextProvider.shared.retain(session)
                }
            }

            // 3. Exchange callback URL for a session
            try await db.auth.session(from: callbackURL)
        } catch {
            // Error code 1 = user cancelled the browser session — silently ignore
            let nsErr = error as NSError
            if nsErr.domain == "com.apple.AuthenticationServices.WebAuthenticationSession" && nsErr.code == 1 {
                return
            }
            self.error = "เข้าสู่ระบบไม่สำเร็จ: \(error.localizedDescription)"
        }
    }

    // MARK: – Sign in with LINE
    /// LINE is **not** a native Supabase OAuth provider — the web app runs a
    /// custom server-side flow (`/api/auth/line` → LINE → `/api/auth/line/callback`,
    /// see `web/src/app/api/auth/line/*`) that creates/links a Supabase user and
    /// hands back a session via a Supabase magic-link.
    ///
    /// We open that exact flow with `?platform=ios`, which tells the callback
    /// route to redirect the minted session straight to `slippy://auth/callback`
    /// (instead of the web's hash-reading page) so `ASWebAuthenticationSession`
    /// can capture it here, exactly like the Google/Facebook flow above.
    func signInWithLine() async {
        error = nil
        do {
            let startURL = Config.webAppURL
                .appendingPathComponent("api/auth/line")
                .appending(queryItems: [URLQueryItem(name: "platform", value: "ios")])

            let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
                DispatchQueue.main.async {
                    let session = ASWebAuthenticationSession(
                        url: startURL,
                        callbackURLScheme: "slippy"
                    ) { url, sessionError in
                        if let url {
                            continuation.resume(returning: url)
                        } else {
                            continuation.resume(throwing: sessionError ?? URLError(.cancelled))
                        }
                    }
                    session.prefersEphemeralWebBrowserSession = false
                    session.presentationContextProvider = PresentationContextProvider.shared
                    session.start()
                    PresentationContextProvider.shared.retain(session)
                }
            }

            // The callback can also carry `?error=line_xxx` if the server-side
            // flow failed before a session could be minted.
            if let comps = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
               let errCode = comps.queryItems?.first(where: { $0.name == "error" })?.value {
                self.error = "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ (\(errCode))"
                return
            }

            try await db.auth.session(from: callbackURL)
        } catch {
            let nsErr = error as NSError
            if nsErr.domain == "com.apple.AuthenticationServices.WebAuthenticationSession" && nsErr.code == 1 {
                return
            }
            self.error = "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ: \(error.localizedDescription)"
        }
    }

    // MARK: – Sign in with Apple
    func signInWithApple(credential: ASAuthorizationAppleIDCredential) async {
        error = nil
        guard
            let idTokenData = credential.identityToken,
            let idToken = String(data: idTokenData, encoding: .utf8)
        else {
            self.error = "ไม่สามารถอ่าน Apple ID Token ได้"
            return
        }
        do {
            try await db.auth.signInWithIdToken(
                credentials: .init(
                    provider: .apple,
                    idToken: idToken,
                    nonce: nil
                )
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: – Fetch helpers
    private func fetchProfile() async {
        guard let userId = session?.user.id.uuidString else { return }
        do {
            // maybeSingle() returns nil instead of throwing when no row found
            profile = try await db
                .from("users")
                .select()
                .eq("id", value: userId)
                .limit(1)
                .execute()
                .value
        } catch { print("[Auth] Profile error:", error) }
    }

    private func fetchMembership() async {
        guard let userId = session?.user.id.uuidString else { return }
        do {
            let results: [OrganizationMember] = try await db
                .from("organization_members")
                .select("*, organizations(*)")
                .eq("user_id", value: userId)
                .execute()
                .value
            memberships = results

            // Honour the locally-persisted "active org" choice if it's still
            // a valid membership — same fallback logic as web's getMembership().
            let savedOrgId = UserDefaults.standard.string(forKey: Self.activeOrgKey)
            membership = (savedOrgId.flatMap { id in results.first { $0.organizations.id == id } })
                ?? results.first
        } catch { print("[Auth] Membership error:", error) }
    }

    /// Switches the active organization — mirrors `/api/org/switch`'s
    /// membership-verification, persisted locally (mobile's analogue of the
    /// web's `active-org` cookie).
    func switchOrg(to organizationId: String) {
        guard let target = memberships.first(where: { $0.organizations.id == organizationId }) else { return }
        membership = target
        UserDefaults.standard.set(organizationId, forKey: Self.activeOrgKey)
        hapticSuccess()
    }

    /// Updates the user's profile fields directly on `users` — same table the
    /// web reads/writes for account info (full_name/avatar_url).
    func updateProfile(fullName: String) async -> Bool {
        guard let userId = session?.user.id.uuidString else { return false }
        do {
            struct Patch: Encodable { let full_name: String }
            let updated: UserProfile = try await db
                .from("users")
                .update(Patch(full_name: fullName))
                .eq("id", value: userId)
                .select()
                .single()
                .execute()
                .value
            profile = updated
            hapticSuccess()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    var org: Organization? { membership?.organizations }
    var isSignedIn: Bool { session != nil && !isLoading }

#if DEBUG
    /// Preview-only init — skips network tasks.
    init(_preview: Bool) {
        // intentionally empty; call setPreviewData() after
    }

    func setPreviewData(profile: UserProfile, org: Organization, role: String = "owner") {
        self.isLoading = false
        self.profile = profile
        let orgMember = OrganizationMember(
            id: "preview-member",
            userId: "preview-user",
            role: role,
            joinedAt: "2026-01-01T00:00:00Z",
            organizations: org
        )
        self.membership = orgMember
        self.memberships = [orgMember]
    }
#endif
}

// MARK: – ASWebAuthenticationSession presentation context
/// Provides the window anchor for ASWebAuthenticationSession and retains active sessions.
final class PresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = PresentationContextProvider()
    private var activeSession: ASWebAuthenticationSession?

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }

    func retain(_ session: ASWebAuthenticationSession) { activeSession = session }
}
