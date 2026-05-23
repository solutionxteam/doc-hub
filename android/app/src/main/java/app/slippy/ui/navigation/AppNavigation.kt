package app.slippy.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.slippy.ui.analytics.AnalyticsScreen
import app.slippy.ui.auth.LoginScreen
import app.slippy.ui.auth.LoginViewModel
import app.slippy.ui.dashboard.DashboardScreen
import app.slippy.ui.documents.CameraScreen
import app.slippy.ui.documents.DocumentsScreen
import app.slippy.ui.profile.ProfileScreen
import app.slippy.ui.theme.Brand500

sealed class Screen(val route: String) {
    object Login     : Screen("login")
    object Dashboard : Screen("dashboard")
    object Documents : Screen("documents")
    object Camera    : Screen("camera")
    object Analytics : Screen("analytics")
    object Profile   : Screen("profile")
}

data class TabItem(val screen: Screen, val label: String, val icon: ImageVector)

val bottomTabs = listOf(
    TabItem(Screen.Dashboard, "แดชบอร์ด", Icons.Filled.Dashboard),
    TabItem(Screen.Documents, "เอกสาร",   Icons.Filled.Description),
    TabItem(Screen.Camera,    "สแกน",     Icons.Filled.CameraAlt),
    TabItem(Screen.Analytics, "รายงาน",   Icons.Filled.BarChart),
    TabItem(Screen.Profile,   "โปรไฟล์",  Icons.Filled.Person),
)

@Composable
fun AppNavigation(isSignedIn: Boolean) {
    val navController = rememberNavController()
    val startDest     = if (isSignedIn) Screen.Dashboard.route else Screen.Login.route

    NavHost(navController = navController, startDestination = startDest) {
        composable(Screen.Login.route) {
            val vm = hiltViewModel<LoginViewModel>()
            LoginScreen(
                vm = vm,
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }
        composable(Screen.Dashboard.route) {
            MainScaffold(navController, Screen.Dashboard) {
                DashboardScreen(
                    onUpload   = { navController.navigate(Screen.Camera.route) },
                    onViewDocs = { navController.navigate(Screen.Documents.route) }
                )
            }
        }
        composable(Screen.Documents.route) {
            MainScaffold(navController, Screen.Documents) {
                DocumentsScreen(onCamera = { navController.navigate(Screen.Camera.route) })
            }
        }
        composable(Screen.Camera.route) {
            MainScaffold(navController, Screen.Camera) {
                CameraScreen(onDone = { navController.popBackStack() })
            }
        }
        composable(Screen.Analytics.route) {
            MainScaffold(navController, Screen.Analytics) { AnalyticsScreen() }
        }
        composable(Screen.Profile.route) {
            MainScaffold(navController, Screen.Profile) {
                ProfileScreen(
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun MainScaffold(
    navController: androidx.navigation.NavHostController,
    currentScreen: Screen,
    content: @Composable () -> Unit
) {
    val navBackStack by navController.currentBackStackEntryAsState()
    val currentDest  = navBackStack?.destination

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = androidx.compose.ui.graphics.Color.White) {
                bottomTabs.forEach { tab ->
                    val selected = currentDest?.hierarchy?.any { it.route == tab.screen.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick  = {
                            navController.navigate(tab.screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState    = true
                            }
                        },
                        icon     = { Icon(tab.icon, contentDescription = tab.label) },
                        label    = { Text(tab.label, style = MaterialTheme.typography.labelSmall) },
                        colors   = NavigationBarItemDefaults.colors(indicatorColor = Brand500.copy(alpha = 0.12f))
                    )
                }
            }
        }
    ) { padding ->
        androidx.compose.foundation.layout.Box(Modifier.padding(padding)) { content() }
    }
}
