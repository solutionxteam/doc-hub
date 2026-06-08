package app.slippy.data.repository

import app.slippy.data.models.Organization
import app.slippy.data.models.OrganizationMember
import app.slippy.data.models.UserProfile
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.gotrue.providers.Facebook
import io.github.jan.supabase.gotrue.providers.Google
import io.github.jan.supabase.gotrue.providers.OAuthProvider
import android.net.Uri
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val supabase: SupabaseClient
) {
    val sessionFlow: Flow<Boolean>
        get() = supabase.auth.sessionStatus.map { status ->
            status.toString().startsWith("Authenticated")
        }

    suspend fun signIn(email: String, password: String) {
        supabase.auth.signInWith(Email) {
            this.email    = email
            this.password = password
        }
    }

    suspend fun signOut() {
        supabase.auth.signOut()
    }

    /**
     * Returns the OAuth sign-in URL for the given provider.
     * The caller opens it with Chrome Custom Tabs; after the redirect back to
     * "slippy://auth/callback" the app calls [handleOAuthCallback].
     */
    suspend fun getOAuthUrl(provider: OAuthProvider): Uri {
        val url = supabase.auth.getOAuthUrl(
            provider = provider,
            redirectUrl = "slippy://auth/callback"
        )
        return Uri.parse(url)
    }

    /**
     * Exchange the deep-link URI (slippy://auth/callback?...) for a session.
     * Supports both PKCE flow (?code=...) and implicit flow (#access_token=...).
     */
    suspend fun handleOAuthCallback(uri: Uri) {
        // PKCE flow — URI has ?code=... query param
        val code = uri.getQueryParameter("code")
        if (code != null) {
            supabase.auth.exchangeCodeForSession(code)
            return
        }
        // Implicit flow — URI fragment contains access_token & refresh_token
        val fragment = uri.fragment ?: return
        val params = fragment.split("&").associate {
            val parts = it.split("=", limit = 2)
            parts[0] to (parts.getOrNull(1) ?: "")
        }
        val accessToken  = params["access_token"]  ?: return
        val refreshToken = params["refresh_token"] ?: ""
        supabase.auth.importAuthToken(accessToken, refreshToken, retrieveUser = true)
    }

    fun currentUserId(): String? =
        supabase.auth.currentSessionOrNull()?.user?.id

    fun currentUserEmail(): String? =
        supabase.auth.currentSessionOrNull()?.user?.email

    suspend fun fetchProfile(userId: String): UserProfile =
        supabase.from("users")
            .select { filter { eq("id", userId) } }
            .decodeSingle()

    suspend fun fetchOrgMembership(userId: String): OrganizationMember =
        supabase.from("organization_members")
            .select { filter { eq("user_id", userId) } }
            .decodeSingle()

    suspend fun fetchOrganization(orgId: String): Organization =
        supabase.from("organizations")
            .select { filter { eq("id", orgId) } }
            .decodeSingle()
}
