package app.slippy.ui.documents

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import app.slippy.data.models.SlippyDocument
import app.slippy.ui.dashboard.DocRowCard
import app.slippy.ui.dashboard.StatusChip
import app.slippy.ui.theme.*
import app.slippy.utils.fmtTHB

private val filterChips = listOf(
    "ทั้งหมด" to null,
    "ตรวจสอบ" to "reviewing",
    "อนุมัติ"  to "approved",
    "ส่งแล้ว" to "pushed",
    "ผิดพลาด" to "failed",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentsScreen(
    vm: DocumentsViewModel = hiltViewModel(),
    onCamera: () -> Unit
) {
    val state by vm.state.collectAsState()
    var searchText by remember { mutableStateOf("") }

    LaunchedEffect(Unit) { vm.init() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("เอกสาร", fontWeight = FontWeight.ExtraBold) },
                actions = {
                    IconButton(onClick = onCamera) {
                        Icon(Icons.Filled.Add, null, tint = Brand500)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = Background
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            // Search bar
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it; vm.search(it) },
                placeholder = { Text("ค้นหาชื่อผู้ขาย…") },
                leadingIcon = { Icon(Icons.Filled.Search, null) },
                singleLine  = true,
                modifier    = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                shape       = RoundedCornerShape(12.dp)
            )

            // Filter chips
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filterChips) { (label, status) ->
                    val active = state.filterStatus == status
                    FilterChip(
                        selected = active,
                        onClick  = { vm.applyFilter(status) },
                        label    = { Text(label, fontSize = 13.sp) },
                        colors   = FilterChipDefaults.filterChipColors(
                            selectedContainerColor    = Brand500,
                            selectedLabelColor        = Color.White,
                        )
                    )
                }
            }

            Spacer(Modifier.height(4.dp))
            HorizontalDivider(color = BorderColor)

            // List
            when {
                state.isLoading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Brand500)
                    }
                }
                state.documents.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.Inbox, null,
                                tint = BorderColor, modifier = Modifier.size(56.dp))
                            Spacer(Modifier.height(12.dp))
                            Text("ไม่พบเอกสาร", fontSize = 16.sp, fontWeight = FontWeight.SemiBold,
                                color = TextSecondary)
                            Text("ลองเปลี่ยน filter หรือเพิ่มเอกสารใหม่",
                                fontSize = 13.sp, color = TextSecondary)
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.documents) { doc -> DocumentCardFull(doc) }
                    }
                }
            }
        }
    }
}

@Composable
fun DocumentCardFull(doc: SlippyDocument) {
    Card(
        Modifier.fillMaxWidth(),
        shape  = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    Modifier.size(44.dp).background(Brand50, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) { Icon(Icons.Filled.Description, null, tint = Brand500, modifier = Modifier.size(22.dp)) }

                Column(Modifier.weight(1f)) {
                    Text(doc.vendorName ?: doc.fileName,
                        fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, color = TextPrimary)
                    doc.invoiceNumber?.let { Text(it, fontSize = 12.sp, color = TextSecondary) }
                    doc.category?.let {
                        Text(it, fontSize = 11.sp, color = Brand500, fontWeight = FontWeight.Medium)
                    }
                }

                Column(horizontalAlignment = Alignment.End) {
                    doc.totalAmount?.let {
                        Text(fmtTHB(it), fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                    }
                    StatusChip(doc.status)
                }
            }

            // Confidence bar
            doc.overallConfidence?.let { conf ->
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Filled.Psychology, null,
                        tint = TextSecondary, modifier = Modifier.size(12.dp))
                    LinearProgressIndicator(
                        progress = { conf.toFloat() },
                        modifier = Modifier.weight(1f).height(3.dp),
                        color    = if (conf > 0.9) StatusApproved else StatusReviewing,
                        trackColor = BorderColor
                    )
                    Text("${(conf * 100).toInt()}%", fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold, color = TextSecondary)
                }
            }
        }
    }
}
