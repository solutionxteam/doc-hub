package app.slippy.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import app.slippy.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    vm: ProfileViewModel = hiltViewModel(),
    onLogout: () -> Unit
) {
    val state by vm.state.collectAsState()
    var showLogout by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { vm.load() }
    LaunchedEffect(state.loggedOut) { if (state.loggedOut) onLogout() }

    if (showLogout) {
        AlertDialog(
            onDismissRequest = { showLogout = false },
            title  = { Text("ออกจากระบบ") },
            text   = { Text("คุณต้องการออกจากระบบหรือไม่?") },
            confirmButton = {
                TextButton(onClick = { showLogout = false; vm.signOut() }) {
                    Text("ออกจากระบบ", color = StatusFailed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogout = false }) { Text("ยกเลิก") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title  = { Text("โปรไฟล์", fontWeight = FontWeight.ExtraBold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = Background
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
        ) {
            // Hero
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(SurfaceWhite)
                    .padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box {
                    Box(
                        Modifier.size(88.dp).background(Brand500, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(state.initials, fontSize = 30.sp, fontWeight = FontWeight.Black,
                            color = Color.White)
                    }
                    Box(
                        Modifier.size(18.dp).align(Alignment.BottomEnd)
                            .background(StatusApproved, CircleShape)
                            .padding(2.dp)
                    )
                }
                Spacer(Modifier.height(12.dp))
                Text(state.displayName, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Text(state.email, fontSize = 14.sp, color = TextSecondary)
                Spacer(Modifier.height(10.dp))
                Surface(shape = RoundedCornerShape(20.dp), color = Brand500.copy(0.12f)) {
                    Text(
                        state.roleLabel.uppercase(),
                        fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        color = Brand500, letterSpacing = 0.5.sp,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp)
                    )
                }
                if (state.orgName.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text("${state.orgName} · ${state.orgPlan.uppercase()}",
                        fontSize = 12.sp, color = TextSecondary, textAlign = TextAlign.Center)
                }
            }

            HorizontalDivider(color = BorderColor)

            // Account section
            ProfileSection("บัญชี") {
                InfoRow("ชื่อ-นามสกุล", state.displayName)
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(start = 16.dp))
                InfoRow("อีเมล", state.email)
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(start = 16.dp))
                InfoRow("บทบาท", state.roleLabel)
            }

            // Preferences
            ProfileSection("การตั้งค่า") {
                ToggleRow("Biometric Login", "Face ID / Fingerprint", state.biometricEnabled) {
                    vm.toggleBiometric(it)
                }
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(start = 16.dp))
                ToggleRow("แจ้งเตือนผ่าน LINE", "Push ผ่าน Slippy Bot", state.lineNotif) {
                    vm.toggleLineNotif(it)
                }
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(start = 16.dp))
                ToggleRow("รายงานรายสัปดาห์", "สรุปทุกวันจันทร์", state.weeklyReport) {
                    vm.toggleWeeklyReport(it)
                }
            }

            // Actions
            ProfileSection("การดำเนินการ") {
                ActionRow(Icons.Filled.Lock, "เปลี่ยนรหัสผ่าน") {}
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(start = 16.dp))
                ActionRow(Icons.Filled.Devices, "อุปกรณ์ที่เข้าสู่ระบบ") {}
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(start = 16.dp))
                ActionRow(Icons.Filled.Support, "ติดต่อฝ่ายสนับสนุน") {}
            }

            // App info
            ProfileSection("เกี่ยวกับแอป") {
                InfoRow("เวอร์ชัน", "Slippy Android v1.0.0")
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(start = 16.dp))
                InfoRow("Build", "Native Kotlin / Compose")
            }

            // Logout
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = { showLogout = true },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).height(52.dp),
                shape    = RoundedCornerShape(16.dp),
                colors   = ButtonDefaults.outlinedButtonColors(contentColor = StatusFailed),
                border   = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFFECACA))
            ) {
                if (state.isLoggingOut) CircularProgressIndicator(Modifier.size(20.dp), color = StatusFailed)
                else {
                    Icon(Icons.Filled.Logout, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("ออกจ���กระบบ", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun ProfileSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(
            title.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Bold,
            color = TextSecondary, letterSpacing = 1.sp,
            modifier = Modifier.padding(start = 20.dp, top = 20.dp, bottom = 8.dp)
        )
        Card(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            shape  = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
        ) { Column { content() } }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 14.sp, color = TextSecondary)
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
    }
}

@Composable
private fun ToggleRow(label: String, sub: String, checked: Boolean, onChecked: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            Text(sub, fontSize = 11.sp, color = TextSecondary)
        }
        Switch(checked = checked, onCheckedChange = onChecked,
            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Brand500))
    }
}

@Composable
private fun ActionRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(icon, null, tint = TextSecondary, modifier = Modifier.size(18.dp))
            Text(label, fontSize = 14.sp, color = TextPrimary, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.ChevronRight, null, tint = TextSecondary, modifier = Modifier.size(16.dp))
        }
    }
}
