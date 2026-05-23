package app.slippy.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.slippy.data.models.MonthSummary
import app.slippy.data.models.Organization
import app.slippy.data.models.SlippyDocument
import app.slippy.data.models.UserProfile
import app.slippy.data.repository.AuthRepository
import app.slippy.data.repository.DocumentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class DashboardUiState(
    val isLoading   : Boolean           = true,
    val profile     : UserProfile?      = null,
    val org         : Organization?     = null,
    val recentDocs  : List<SlippyDocument> = emptyList(),
    val monthSummary: MonthSummary?     = null,
    val reviewCount : Int               = 0,
    val error       : String?           = null,
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val authRepo: AuthRepository,
    private val docRepo : DocumentRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DashboardUiState())
    val state = _state.asStateFlow()

    fun load() {
        val userId = authRepo.currentUserId() ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val memberDeferred  = async { authRepo.fetchOrgMembership(userId) }
                val profileDeferred = async { authRepo.fetchProfile(userId) }

                val member  = memberDeferred.await()
                val profile = profileDeferred.await()
                val orgId   = member.organizationId

                val orgDeferred   = async { authRepo.fetchOrganization(orgId) }
                val docsDeferred  = async { docRepo.fetchRecent(orgId) }
                val statsDeferred = async { fetchMonthStats(orgId) }

                val org    = orgDeferred.await()
                val docs   = docsDeferred.await()
                val stats  = statsDeferred.await()

                _state.value = _state.value.copy(
                    isLoading    = false,
                    profile      = profile,
                    org          = org,
                    recentDocs   = docs,
                    monthSummary = stats,
                    reviewCount  = docs.count { it.status == "reviewing" }
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    private suspend fun fetchMonthStats(orgId: String): MonthSummary? {
        val month = SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
        return docRepo.fetchMonthSummaries(orgId).firstOrNull { it.month == month }
    }
}
