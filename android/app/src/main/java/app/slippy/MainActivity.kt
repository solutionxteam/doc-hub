package app.slippy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import app.slippy.ui.auth.LoginViewModel
import app.slippy.ui.navigation.AppNavigation
import app.slippy.ui.theme.SlippyTheme
import dagger.hilt.android.AndroidEntryPoint
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var supabase: SupabaseClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SlippyTheme {
                // Check if user already has a session
                val isSignedIn = remember {
                    supabase.auth.currentSessionOrNull() != null
                }
                AppNavigation(isSignedIn = isSignedIn)
            }
        }
    }
}
