package app.slippy.ui.documents

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.slippy.data.models.SlippyDocument
import app.slippy.data.repository.AuthRepository
import app.slippy.data.repository.DocumentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DocumentsUiState(
    val isLoading    : Boolean              = false,
    val documents    : List<SlippyDocument> = emptyList(),
    val filterStatus : String?              = null,
    val error        : String?              = null,
)

@HiltViewModel
class DocumentsViewModel @Inject constructor(
    private val authRepo: AuthRepository,
    private val docRepo : DocumentRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DocumentsUiState())
    val state = _state.asStateFlow()

    private var orgId      = ""
    private var searchQuery = ""

    fun init() {
        viewModelScope.launch {
            val userId = authRepo.currentUserId() ?: return@launch
            val member = authRepo.fetchOrgMembership(userId)
            orgId = member.organizationId
            fetch()
        }
    }

    fun applyFilter(status: String?) {
        _state.value = _state.value.copy(filterStatus = status)
        fetch()
    }

    fun search(query: String) {
        searchQuery = query
        fetch()
    }

    private fun fetch() {
        if (orgId.isEmpty()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            try {
                val docs = docRepo.fetchFiltered(
                    orgId  = orgId,
                    status = _state.value.filterStatus,
                    query  = searchQuery.ifBlank { null }
                )
                _state.value = _state.value.copy(isLoading = false, documents = docs)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }
}
