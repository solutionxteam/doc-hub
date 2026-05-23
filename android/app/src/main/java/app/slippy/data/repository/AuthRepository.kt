package app.slippy.data.repository

import app.slippy.data.models.Organization
import app.slippy.data.models.OrganizationMember
import app.slippy.data.models.UserProfile
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
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
