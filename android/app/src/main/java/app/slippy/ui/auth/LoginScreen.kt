package app.slippy.ui.auth

import android.content.Intent
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.slippy.ui.theme.*

@Composable
fun LoginScreen(vm: LoginViewModel, onLoginSuccess: () -> Unit) {
    val state   by vm.state.collectAsState()
    val context = LocalContext.current

    var email    by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPw   by remember { mutableStateOf(false) }

    // Navigate on success
    LaunchedEffect(state.success) { if (state.success) onLoginSuccess() }

    // Open Chrome Custom Tab for OAuth
    LaunchedEffect(state.pendingOAuthUri) {
        state.pendingOAuthUri?.let { uri ->
            val tab = CustomTabsIntent.Builder()
                .setShowTitle(false)
                .build()
            tab.launchUrl(context, uri)
            vm.oauthUriConsumed()
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(DarkBg, Color(0xFF0d1023), Color(0xFF0f1235))))
    ) {
        // Glow blob
        Box(
            Modifier
                .size(280.dp).offset((-80).dp, (-180).dp)
                .background(
                    Brush.radialGradient(listOf(Brand500.copy(0.15f), Color.Transparent)),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
        )

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(72.dp))

            // ── Logo ──
            Surface(
                Modifier.size(76.dp),
                shape = androidx.compose.foundation.shape.CircleShape,
                color = Brand500.copy(alpha = 0.18f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("S", fontSize = 34.sp, fontWeight = FontWeight.Black, color = Brand400)
                }
            }
            Spacer(Modifier.height(14.dp))
            Text("Slippy", fontSize = 26.sp, fontWeight = FontWeight.Black, color = Color.White)
            Text(
                "ระบบจัดการเอกสารบัญชีอัจฉริยะ",
                fontSize = 13.sp, color = Color.White.copy(0.5f), textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(36.dp))

            // ── Social login ──
            val busy = state.isLoading || state.oauthLoading != null

            // Google — full width
            SocialButton(
                label = "เข้าสู่ระบบด้วย Google",
                leadingContent = {
                    Box(
                        Modifier.size(22.dp)
                            .background(Color.White, shape = RoundedCornerShape(4.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("G", fontSize = 12.sp, fontWeight = FontWeight.Black,
                            color = Color(0xFF4285F4))
                    }
                },
                bgColor = Color.White,
                fgColor = Color(0xFF3c4043),
                isLoading = state.oauthLoading == "Google",
                enabled = !busy,
                onClick = { vm.startGoogleLogin() }
            )

            Spacer(Modifier.height(10.dp))

            // Facebook · LINE · Apple — 3-col
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CompactSocialBtn(
                    label = "Facebook", bgColor = Color(0xFF1877F2),
                    isLoading = state.oauthLoading == "Facebook", enabled = !busy,
                    onClick = { vm.startFacebookLogin() },
                    modifier = Modifier.weight(1f)
                )
                CompactSocialBtn(
                    label = "LINE", bgColor = Color(0xFF06C755),
                    isLoading = state.oauthLoading == "LINE", enabled = !busy,
                    onClick = { vm.startLineLogin() },
                    modifier = Modifier.weight(1f)
                )
                // Apple — note: Google Play doesn't require Apple login
                // Shown for parity with iOS; opens OAuth URL
                CompactSocialBtn(
                    label = "Apple", bgColor = Color.Black,
                    isLoading = state.oauthLoading == "Apple", enabled = !busy,
                    onClick = { /* Apple Sign In not required on Android */ },
                    modifier = Modifier.weight(1f)
                )
            }

            // Divider
            Row(
                Modifier.fillMaxWidth().padding(vertical = 20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(Modifier.weight(1f), color = Color.White.copy(0.12f))
                Text(
                    "  หรือใช้อีเมล  ",
                    fontSize = 11.sp, color = Color.White.copy(0.4f),
                    fontWeight = FontWeight.Medium
                )
                HorizontalDivider(Modifier.weight(1f), color = Color.White.copy(0.12f))
            }

            // ── Email / password card ──
            Card(
                Modifier.fillMaxWidth(),
                shape  = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                elevation = CardDefaults.cardElevation(8.dp)
            ) {
                Column(
                    Modifier.padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    state.error?.let { err ->
                        Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                            color = StatusFailed.copy(0.08f)) {
                            Text(err, color = StatusFailed, fontSize = 13.sp,
                                modifier = Modifier.padding(12.dp))
                        }
                    }

                    OutlinedTextField(
                        value = email, onValueChange = { email = it; vm.clearError() },
                        label = { Text("อีเมล") },
                        leadingIcon = { Icon(Icons.Filled.Email, null) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    OutlinedTextField(
                        value = password, onValueChange = { password = it; vm.clearError() },
                        label = { Text("รหัสผ่าน") },
                        leadingIcon = { Icon(Icons.Filled.Lock, null) },
                        trailingIcon = {
                            IconButton(onClick = { showPw = !showPw }) {
                                Icon(
                                    if (showPw) Icons.Filled.Lock else Icons.Filled.Lock,
                                    contentDescription = if (showPw) "ซ่อน" else "แสดง"
                                )
                            }
                        },
                        singleLine = true,
                        visualTransformation = if (showPw) VisualTransformation.None
                                               else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Button(
                        onClick = { vm.signIn(email, password) },
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(13.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Brand500)
                    ) {
                        if (state.isLoading) {
                            CircularProgressIndicator(Modifier.size(20.dp), color = Color.White,
                                strokeWidth = 2.dp)
                        } else {
                            Text("เข้าสู่ระบบ", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}

// ── Shared composables ────────────────────────────────────────────────────────
@Composable
private fun SocialButton(
    label: String,
    leadingContent: @Composable () -> Unit = {},
    bgColor: Color, fgColor: Color,
    isLoading: Boolean, enabled: Boolean,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick, enabled = enabled,
        modifier = Modifier.fillMaxWidth().height(50.dp),
        shape = RoundedCornerShape(13.dp),
        colors = ButtonDefaults.buttonColors(containerColor = bgColor,
                                              contentColor = fgColor,
                                              disabledContainerColor = bgColor.copy(0.7f))
    ) {
        if (isLoading) {
            CircularProgressIndicator(Modifier.size(18.dp), color = fgColor, strokeWidth = 2.dp)
        } else {
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center) {
                leadingContent()
                Spacer(Modifier.width(10.dp))
                Text(label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = fgColor)
            }
        }
    }
}

@Composable
private fun CompactSocialBtn(
    label: String, bgColor: Color,
    isLoading: Boolean, enabled: Boolean,
    onClick: () -> Unit, modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick, enabled = enabled,
        modifier = modifier.height(46.dp),
        shape = RoundedCornerShape(13.dp),
        colors = ButtonDefaults.buttonColors(containerColor = bgColor,
                                              disabledContainerColor = bgColor.copy(0.6f))
    ) {
        if (isLoading) {
            CircularProgressIndicator(Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
        } else {
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}
