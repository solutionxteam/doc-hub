package app.slippy.ui.auth

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.slippy.ui.theme.*

@Composable
fun LoginScreen(vm: LoginViewModel, onLoginSuccess: () -> Unit) {
    val state by vm.state.collectAsState()
    var email    by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    LaunchedEffect(state.success) {
        if (state.success) onLoginSuccess()
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(DarkBg, DarkCard, Color(0xFF0f1235))))
    ) {
        // Glow blob
        Box(
            Modifier
                .size(280.dp)
                .offset((-80).dp, (-180).dp)
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
            Spacer(Modifier.height(80.dp))

            // Logo (branded lettermark)
            Surface(
                Modifier.size(80.dp),
                shape = androidx.compose.foundation.shape.CircleShape,
                color = Brand500.copy(alpha = 0.2f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "S",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Black,
                        color = Brand400
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Text("Slippy", fontSize = 28.sp, fontWeight = FontWeight.Black, color = Color.White)
            Text(
                "ระบบจัดการเอกสารบัญชีอัจฉริยะ",
                fontSize = 14.sp, color = Color.White.copy(0.55f),
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(48.dp))

            // Card
            Card(
                Modifier.fillMaxWidth(),
                shape  = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                elevation = CardDefaults.cardElevation(8.dp)
            ) {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    // Error
                    state.error?.let { err ->
                        Surface(
                            Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            color = StatusFailed.copy(0.08f)
                        ) {
                            Text(
                                err, color = StatusFailed,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    // Email
                    OutlinedTextField(
                        value = email, onValueChange = { email = it; vm.clearError() },
                        label       = { Text("อีเมล") },
                        leadingIcon = { Icon(Icons.Filled.Email, null) },
                        singleLine  = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier    = Modifier.fillMaxWidth(),
                        shape       = RoundedCornerShape(12.dp)
                    )

                    // Password
                    OutlinedTextField(
                        value = password, onValueChange = { password = it; vm.clearError() },
                        label           = { Text("รหัสผ่าน") },
                        leadingIcon     = { Icon(Icons.Filled.Lock, null) },
                        singleLine      = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier        = Modifier.fillMaxWidth(),
                        shape           = RoundedCornerShape(12.dp)
                    )

                    // Button
                    Button(
                        onClick  = { vm.signIn(email, password) },
                        enabled  = !state.isLoading,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape    = RoundedCornerShape(14.dp),
                        colors   = ButtonDefaults.buttonColors(containerColor = Brand500)
                    ) {
                        if (state.isLoading) {
                            CircularProgressIndicator(Modifier.size(20.dp), color = Color.White)
                        } else {
                            Text("เข้าสู่ระบบ", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}
