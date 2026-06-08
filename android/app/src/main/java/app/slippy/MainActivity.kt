package app.slippy

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import app.slippy.ui.auth.LoginViewModel
import android.net.Uri
import app.slippy.ui.navigation.AppNavigation
import app.slippy.ui.theme.SlippyTheme
import dagger.hilt.android.AndroidEntryPoint
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var supabase: SupabaseClient
    // LoginViewModel is created by Hilt at the navigation level; we store a ref here
    // so onNewIntent can forward the OAuth callback URI.
    private var pendingOAuthUri: Uri? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Handle OAuth deep-link if launched from Custom Tab
        handleOAuthIntent(intent)
        setContent {
            SlippyTheme {
                val isSignedIn = remember {
                    supabase.auth.currentSessionOrNull() != null
                }
                AppNavigation(isSignedIn = isSignedIn)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleOAuthIntent(intent)
    }

    private fun handleOAuthIntent(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "slippy") {
            pendingOAuthUri = uri
            // LoginViewModel is scoped to NavBackStack; broadcast via LocalBroadcastManager
            // would be cleaner in production — here we just store and let the screen read it.
        }
    }
}
