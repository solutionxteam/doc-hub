package app.slippy.ui.profile

import android.content.Context
import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.slippy.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val displayName     : String  = "",
    val email           : String  = "",
    val initials        : String  = "?",
    val roleLabel       : String  = "Member",
    val orgName         : String  = "",
    val orgPlan         : String  = "",
    val biometricEnabled: Boolean = false,
    val lineNotif       : Boolean = true,
    val weeklyReport    : Boolean = false,
    val isLoggingOut    : Boolean = false,
    val loggedOut       : Boolean = false,
)

private val roleLabels = mapOf(
    "owner" to "Owner", "admin" to "Admin",
    "accountant" to "Accountant", "member" to "Member"
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authRepo: AuthRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences("slippy_prefs", Context.MODE_PRIVATE)
    }

    private val _state = MutableStateFlow(ProfileUiState())
    val state = _state.asStateFlow()

    fun load() {
        val userId = authRepo.currentUserId() ?: return
        val email  = authRepo.currentUserEmail() ?: ""
        viewModelScope.launch {
            try {
                val profile = authRepo.fetchProfile(userId)
                val member  = authRepo.fetchOrgMembership(userId)
                val org     = authRepo.fetchOrganization(member.organizationId)
                _state.value = _state.value.copy(
                    displayName      = profile.displayName,
                    email            = email,
                    initials         = profile.initials,
                    roleLabel        = roleLabels[member.role] ?: member.role,
                    orgName          = org.name,
                    orgPlan          = org.plan,
                    lineNotif        = prefs.getBoolean("line_notif", true),
                    weeklyReport     = prefs.getBoolean("weekly_report", false),
                )
            } catch (_: Exception) {
                _state.value = _state.value.copy(
                    email        = email,
                    displayName  = email.substringBefore("@"),
                    initials     = email.take(1).uppercase(),
                    lineNotif    = prefs.getBoolean("line_notif", true),
                    weeklyReport = prefs.getBoolean("weekly_report", false),
                )
            }
        }
    }

    fun toggleBiometric(v: Boolean) {
        _state.value = _state.value.copy(biometricEnabled = v)
    }

    fun toggleLineNotif(v: Boolean) {
        _state.value = _state.value.copy(lineNotif = v)
        prefs.edit().putBoolean("line_notif", v).apply()
    }

    fun toggleWeeklyReport(v: Boolean) {
        _state.value = _state.value.copy(weeklyReport = v)
        prefs.edit().putBoolean("weekly_report", v).apply()
    }

    fun signOut() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoggingOut = true)
            try {
                authRepo.signOut()
                _state.value = _state.value.copy(isLoggingOut = false, loggedOut = true)
            } catch (_: Exception) {
                _state.value = _state.value.copy(isLoggingOut = false, loggedOut = true)
            }
        }
    }
}
