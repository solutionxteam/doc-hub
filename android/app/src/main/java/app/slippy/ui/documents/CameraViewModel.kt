package app.slippy.ui.documents

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.slippy.data.repository.AuthRepository
import app.slippy.data.repository.DocumentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

/** Read a URI (file:// or content://) into a ByteArray via ContentResolver */
private fun Uri.readBytes(context: Context): ByteArray? =
    context.contentResolver.openInputStream(this)?.use { it.readBytes() }

data class CameraUiState(
    val mode          : CameraMode = CameraMode.SELECT,
    val imageUri      : Uri?       = null,
    val isUploading   : Boolean    = false,
    val uploadSuccess : Boolean    = false,
    val error         : String?    = null,
)

@HiltViewModel
class CameraViewModel @Inject constructor(
    private val authRepo: AuthRepository,
    private val docRepo : DocumentRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CameraUiState())
    val state = _state.asStateFlow()

    private var cameraUri: Uri? = null

    fun createImageUri(context: Context): Uri {
        val file = File(context.cacheDir, "capture_${System.currentTimeMillis()}.jpg")
        val uri  = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
        cameraUri = uri
        return uri
    }

    fun confirmCamera() {
        cameraUri?.let { uri ->
            _state.value = _state.value.copy(imageUri = uri, mode = CameraMode.PREVIEW)
        }
    }

    fun setImage(uri: Uri, context: Context) {
        _state.value = _state.value.copy(imageUri = uri, mode = CameraMode.PREVIEW, error = null)
    }

    fun reset() {
        _state.value = CameraUiState()
        cameraUri    = null
    }

    fun upload(context: Context) {
        val uri    = _state.value.imageUri ?: return
        val userId = authRepo.currentUserId() ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(isUploading = true, error = null)
            try {
                val bytes    = uri.readBytes(context)
                    ?: throw IllegalStateException("ไม่สามารถอ่านไฟล์ได้")
                val member   = authRepo.fetchOrgMembership(userId)
                val fileName = "${userId}_${System.currentTimeMillis()}.jpg"
                docRepo.uploadDocument(member.organizationId, userId, bytes, fileName)
                _state.value = _state.value.copy(isUploading = false, uploadSuccess = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isUploading = false, error = e.message)
            }
        }
    }
}
