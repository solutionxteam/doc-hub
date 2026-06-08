package app.slippy.ui.auth

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.slippy.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jan.supabase.gotrue.providers.Facebook
import io.github.jan.supabase.gotrue.providers.Google
import io.github.jan.supabase.gotrue.providers.OAuthProvider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val isLoading     : Boolean = false,
    val oauthLoading  : String? = null,   // "Google" | "Facebook" | "LINE" | null
    val error         : String? = null,
    val success       : Boolean = false,
    val pendingOAuthUri: Uri?   = null,   // URL to open in Custom Tabs
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepo: AuthRepository
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state = _state.asStateFlow()

    // ── Email / password ─────────────────────────────────────────────────────
    fun signIn(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _state.value = _state.value.copy(error = "กรุณากรอกอีเมลและรหัสผ่าน"); return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                authRepo.signIn(email.trim(), password)
                _state.value = _state.value.copy(isLoading = false, success = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message ?: "เข้าสู่ระบบล้มเหลว")
            }
        }
    }

    // ── OAuth (Google / Facebook / LINE) ─────────────────────────────────────
    fun startOAuth(providerName: String, provider: OAuthProvider) {
        viewModelScope.launch {
            _state.value = _state.value.copy(oauthLoading = providerName, error = null)
            try {
                val uri = authRepo.getOAuthUrl(provider)
                _state.value = _state.value.copy(pendingOAuthUri = uri, oauthLoading = providerName)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    oauthLoading = null,
                    error = "ไม่สามารถเริ่ม $providerName login ได้: ${e.message}"
                )
            }
        }
    }

    fun startGoogleLogin()   = startOAuth("Google",   Google)
    fun startFacebookLogin() = startOAuth("Facebook", Facebook)
    fun startLineLogin()     = startOAuth("LINE",     object : OAuthProvider() { override val name = "line" })

    /** Called by MainActivity after Chrome Custom Tab returns the deep-link. */
    fun handleOAuthCallback(uri: Uri) {
        viewModelScope.launch {
            try {
                authRepo.handleOAuthCallback(uri)
                _state.value = _state.value.copy(success = true, oauthLoading = null, pendingOAuthUri = null)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    oauthLoading = null,
                    pendingOAuthUri = null,
                    error = "OAuth callback ล้มเหลว: ${e.message}"
                )
            }
        }
    }

    fun oauthUriConsumed() {
        _state.value = _state.value.copy(pendingOAuthUri = null)
    }

    fun clearError() { _state.value = _state.value.copy(error = null) }
}
