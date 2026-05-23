package app.slippy.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import app.slippy.data.models.SlippyDocument
import app.slippy.ui.theme.*
import app.slippy.utils.fmtTHB
import app.slippy.utils.relTime
import app.slippy.utils.statusLabel

@Composable
fun DashboardScreen(
    vm: DashboardViewModel = hiltViewModel(),
    onUpload: () -> Unit,
    onViewDocs: () -> Unit
) {
    val state by vm.state.collectAsState()
    LaunchedEffect(Unit) { vm.load() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Background),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    val firstName = state.profile?.displayName?.split(" ")?.firstOrNull() ?: "คุณ"
                    Text("สวัสดี, $firstName 👋",
                        fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                    Text(state.org?.name ?: "Slippy", fontSize = 13.sp, color = TextSecondary)
                }
                IconButton(
                    onClick = onUpload,
                    modifier = Modifier.background(Brand500, CircleShape).size(40.dp)
                ) {
                    Icon(Icons.Filled.Add, null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
            }
        }

        // Stats grid
        item {
            if (state.isLoading) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(2) {
                        Card(Modifier.weight(1f).height(90.dp),
                            colors = CardDefaults.cardColors(containerColor = BorderColor)) {}
                    }
                }
            } else {
                val summary = state.monthSummary
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard(
                            Modifier.weight(1f),
                            title = "เอกสารเดือนนี้",
                            value = "${summary?.docCount ?: 0}",
                            icon  = Icons.Filled.Description,
                            color = Brand500
                        )
                        StatCard(
                            Modifier.weight(1f),
                            title = "ยอดรวม",
                            value = fmtTHB(summary?.grandTotal ?: 0.0),
                            icon  = Icons.Filled.Payments,
                            color = StatusApproved
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard(
                            Modifier.weight(1f),
                            title = "ภาษีมูลค่าเพิ่ม",
                            value = fmtTHB(summary?.vatTotal ?: 0.0),
                            icon  = Icons.Filled.Percent,
                            color = StatusReviewing
                        )
                        StatCard(
                            Modifier.weight(1f),
                            title = "รอตรวจสอบ",
                            value = "${state.reviewCount}",
                            icon  = Icons.Filled.AccessTime,
                            color = StatusPushed
                        )
                    }
                }
            }
        }

        // Quota
        state.org?.let { org ->
            item {
                Card(
                    Modifier.fillMaxWidth(),
                    shape  = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("โควต้าเอกสาร", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            Text("${org.docUsed} / ${org.docQuota}", fontSize = 12.sp, color = TextSecondary)
                        }
                        LinearProgressIndicator(
                            progress = { org.quotaPercent },
                            modifier  = Modifier.fillMaxWidth().height(8.dp),
                            color     = Brand500,
                            trackColor = BorderColor,
                        )
                    }
                }
            }
        }

        // Recent docs header
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text("เอกสารล่าสุด", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                TextButton(onClick = onViewDocs) {
                    Text("ดูทั้งหมด", color = Brand500, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        if (state.recentDocs.isEmpty() && !state.isLoading) {
            item {
                Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Inbox, null, tint = BorderColor, modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(8.dp))
                        Text("ยังไม่มีเอกสาร", color = TextSecondary, fontSize = 14.sp)
                    }
                }
            }
        } else {
            items(state.recentDocs) { doc -> DocRowCard(doc) }
        }
    }
}

@Composable
fun StatCard(modifier: Modifier = Modifier, title: String, value: String, icon: ImageVector, color: Color) {
    Card(
        modifier,
        shape  = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier.size(40.dp).background(color.copy(0.12f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) { Icon(icon, null, tint = color, modifier = Modifier.size(20.dp)) }
            Column {
                Text(value, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Text(title, fontSize = 11.sp, color = TextSecondary, maxLines = 1)
            }
        }
    }
}

@Composable
fun DocRowCard(doc: SlippyDocument) {
    Card(
        Modifier.fillMaxWidth(),
        shape  = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
    ) {
        Row(
            Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                Modifier.size(44.dp).background(Brand50, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) { Icon(Icons.Filled.Description, null, tint = Brand500, modifier = Modifier.size(22.dp)) }

            Column(Modifier.weight(1f)) {
                Text(doc.vendorName ?: doc.fileName, fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold, maxLines = 1, color = TextPrimary)
                Text(relTime(doc.createdAt), fontSize = 12.sp, color = TextSecondary)
            }

            Column(horizontalAlignment = Alignment.End) {
                doc.totalAmount?.let {
                    Text(fmtTHB(it), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
                StatusChip(doc.status)
            }
        }
    }
}

@Composable
fun StatusChip(status: String) {
    val color = statusColor(status)
    Surface(shape = RoundedCornerShape(20.dp), color = color.copy(0.12f)) {
        Text(
            statusLabel(status),
            fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}
