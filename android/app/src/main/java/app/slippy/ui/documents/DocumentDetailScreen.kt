package app.slippy.ui.documents

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import app.slippy.data.models.SlippyDocument
import app.slippy.ui.theme.*
import app.slippy.utils.fmtTHB
import app.slippy.utils.relTime
import app.slippy.utils.statusLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentDetailScreen(
    docId: String,
    onBack: () -> Unit,
    vm: DocumentDetailViewModel = hiltViewModel()
) {
    val state by vm.state.collectAsState()

    LaunchedEffect(docId) { vm.load(docId) }
    LaunchedEffect(state.done) { if (state.done) onBack() }

    // Confirmation dialog state
    var pendingAction by remember { mutableStateOf<String?>(null) }

    if (pendingAction != null) {
        AlertDialog(
            onDismissRequest = { pendingAction = null },
            title = { Text("ยืนยันการดำเนินการ") },
            text = {
                Text(
                    when (pendingAction) {
                        "approved" -> "อนุมัติเอกสารนี้?"
                        "rejected" -> "ปฏิเสธเอกสารนี้?"
                        "pushed"   -> "ส่งเอกสารเข้าระบบ?"
                        else       -> "ดำเนินการต่อ?"
                    }
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val action = pendingAction
                    pendingAction = null
                    if (action != null) vm.updateStatus(docId, action)
                }) {
                    Text(
                        "ยืนยัน",
                        color = if (pendingAction == "rejected") StatusFailed else Brand500,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingAction = null }) { Text("ยกเลิก") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        state.doc?.vendorName ?: "รายละเอียดเอกสาร",
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "กลับ")
                    }
                },
                actions = {
                    state.doc?.let { doc ->
                        StatusBadge(doc.status)
                        Spacer(Modifier.width(12.dp))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        bottomBar = {
            state.doc?.let { doc ->
                when (doc.status) {
                    "reviewing" -> {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .background(SurfaceWhite)
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedButton(
                                onClick = { pendingAction = "rejected" },
                                enabled = !state.acting,
                                modifier = Modifier.weight(1f).height(52.dp),
                                shape  = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusFailed),
                                border = androidx.compose.foundation.BorderStroke(1.5.dp, StatusFailed)
                            ) {
                                if (state.acting) {
                                    CircularProgressIndicator(Modifier.size(18.dp), color = StatusFailed)
                                } else {
                                    Icon(Icons.Filled.Close, null, Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text("ปฏิเสธ", fontWeight = FontWeight.Bold)
                                }
                            }
                            Button(
                                onClick = { pendingAction = "approved" },
                                enabled = !state.acting,
                                modifier = Modifier.weight(1f).height(52.dp),
                                shape  = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Brand500)
                            ) {
                                if (state.acting) {
                                    CircularProgressIndicator(Modifier.size(18.dp), color = Color.White)
                                } else {
                                    Icon(Icons.Filled.Check, null, Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text("อนุมัติ ✓", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    "approved" -> {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .background(SurfaceWhite)
                                .padding(horizontal = 16.dp, vertical = 12.dp)
                        ) {
                            Button(
                                onClick = { pendingAction = "pushed" },
                                enabled = !state.acting,
                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                shape  = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Brand500)
                            ) {
                                if (state.acting) {
                                    CircularProgressIndicator(Modifier.size(18.dp), color = Color.White)
                                } else {
                                    Text("ส่งเข้าระบบ →", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                            }
                        }
                    }
                    else -> {}
                }
            }
        },
        containerColor = Background
    ) { padding ->
        when {
            state.isLoading -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Brand500)
                }
            }
            state.error != null && state.doc == null -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.ErrorOutline, null,
                            tint = StatusFailed, modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(12.dp))
                        Text("โหลดข้อมูลไม่สำเร็จ", fontSize = 16.sp, color = TextPrimary)
                        TextButton(onClick = { vm.load(docId) }) { Text("ลองใหม่") }
                    }
                }
            }
            state.doc != null -> {
                DocumentDetailContent(
                    doc = state.doc!!,
                    modifier = Modifier.padding(padding)
                )
            }
        }
    }
}

@Composable
private fun DocumentDetailContent(doc: SlippyDocument, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Amount hero card
        Box(
            Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(listOf(Brand500, Brand600)),
                    RoundedCornerShape(20.dp)
                )
                .padding(24.dp)
        ) {
            Column {
                Text(
                    doc.vendorName ?: "—",
                    fontSize = 14.sp, color = Color.White.copy(0.8f), fontWeight = FontWeight.Medium
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    doc.totalAmount?.let { fmtTHB(it) } ?: "—",
                    fontSize = 32.sp, fontWeight = FontWeight.Black, color = Color.White
                )
                doc.vatAmount?.let {
                    Text("VAT ${fmtTHB(it)}", fontSize = 13.sp, color = Color.White.copy(0.7f))
                }
                // Confidence chip in hero
                doc.overallConfidence?.let { conf ->
                    Spacer(Modifier.height(10.dp))
                    ConfidenceChip(conf)
                }
            }
        }

        // Extracted data card
        Card(
            Modifier.fillMaxWidth(),
            shape  = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
        ) {
            Column {
                DetailRow("เลขที่ใบกำกับ", doc.invoiceNumber ?: "—")
                HorizontalDivider(color = BorderColor)
                DetailRow("วันที่เอกสาร", doc.docDate ?: "—")
                HorizontalDivider(color = BorderColor)
                DetailRow("ชื่อผู้ขาย", doc.vendorName ?: "—")
                HorizontalDivider(color = BorderColor)
                DetailRow("หมวดหมู่", doc.category ?: "—")
                HorizontalDivider(color = BorderColor)
                DetailRow("ยอดก่อน VAT", doc.subtotalAmount?.let { fmtTHB(it) } ?: "—")
                doc.whtAmount?.let { wht ->
                    HorizontalDivider(color = BorderColor)
                    DetailRow("หัก ณ ที่จ่าย (WHT)", fmtTHB(wht))
                }
                HorizontalDivider(color = BorderColor)
                DetailRow("อัพโหลดเมื่อ", relTime(doc.createdAt))
            }
        }

        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 13.sp, color = TextSecondary)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
    }
}

@Composable
private fun ConfidenceChip(conf: Double) {
    val pct = (conf * 100).toInt()
    val color = when {
        conf >= 0.85 -> StatusApproved
        conf >= 0.60 -> StatusReviewing
        else         -> StatusFailed
    }
    Surface(shape = RoundedCornerShape(20.dp), color = color.copy(0.18f)) {
        Text(
            "$pct%",
            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = color,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val color = statusColor(status)
    Surface(shape = RoundedCornerShape(20.dp), color = color.copy(0.12f)) {
        Text(
            statusLabel(status),
            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = color,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}
