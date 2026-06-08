package app.slippy.ui.documents

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.slippy.data.models.SlippyDocument
import app.slippy.data.repository.DocumentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DocDetailUiState(
    val isLoading: Boolean = true,
    val doc: SlippyDocument? = null,
    val acting: Boolean = false,  // approve/reject/push in progress
    val done: Boolean = false,    // navigate back after action
    val error: String? = null,
)

@HiltViewModel
class DocumentDetailViewModel @Inject constructor(
    private val docRepo: DocumentRepository
) : ViewModel() {
    private val _state = MutableStateFlow(DocDetailUiState())
    val state = _state.asStateFlow()

    fun load(docId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val doc = docRepo.fetchById(docId)
                _state.value = _state.value.copy(isLoading = false, doc = doc)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun updateStatus(docId: String, status: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(acting = true, error = null)
            try {
                docRepo.updateStatus(docId, status)
                _state.value = _state.value.copy(acting = false, done = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(acting = false, error = e.message)
            }
        }
    }
}
