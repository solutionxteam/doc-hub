package app.slippy.ui.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import app.slippy.ui.theme.*
import app.slippy.utils.fmtTHB

private val catColors = listOf(Brand500, StatusPushed, Color(0xFF06B6D4),
    StatusApproved, Color(0xFFF97316))

private val categories = listOf(
    "ค่า Software / Cloud" to 38200.0,
    "ค่าเช่าสำนักงาน"      to 35000.0,
    "ค่าเดินทาง"           to 18700.0,
    "ของใช้สำนักงาน"       to 14250.0,
    "อาหารและเครื่องดื่ม"  to 13420.0,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(vm: AnalyticsViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        topBar = {
            TopAppBar(
                title  = { Text("รายงาน", fontWeight = FontWeight.ExtraBold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = Background
    ) { padding ->
        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Brand500)
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Year total card
                item {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.linearGradient(listOf(Brand500, Brand600)),
                                RoundedCornerShape(24.dp)
                            )
                            .padding(28.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("รวมทั้งปี", fontSize = 13.sp,
                                color = Color.White.copy(0.75f), fontWeight = FontWeight.Medium)
                            Text(fmtTHB(state.yearTotal), fontSize = 34.sp,
                                fontWeight = FontWeight.Black, color = Color.White)
                            Text("จาก ${state.chartData.size} เดือน",
                                fontSize = 12.sp, color = Color.White.copy(0.65f))
                        }
                    }
                }

                // Bar chart card
                item {
                    SectionCard("ค่าใช้จ่ายรายเดือน") {
                        if (state.chartData.isNotEmpty()) {
                            MiniBarChart(state.chartData)
                            Spacer(Modifier.height(10.dp))
                            HorizontalDivider(color = BorderColor)
                            Spacer(Modifier.height(8.dp))
                            state.chartData.lastOrNull()?.let { latest ->
                                Row(Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("เดือนล่าสุด (${latest.label})",
                                        fontSize = 12.sp, color = TextSecondary)
                                    Text(fmtTHB(latest.spend), fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold, color = Brand500)
                                }
                            }
                        }
                    }
                }

                // Category breakdown
                item {
                    val total = categories.sumOf { it.second }.coerceAtLeast(1.0)
                    SectionCard("แยกตามหมวดหมู่") {
                        categories.forEachIndexed { i, (name, value) ->
                            if (i > 0) Spacer(Modifier.height(12.dp))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(8.dp).background(catColors[i % catColors.size], CircleShape))
                                    Text(name, fontSize = 12.sp, color = TextPrimary)
                                }
                                Text(fmtTHB(value), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                            Spacer(Modifier.height(4.dp))
                            LinearProgressIndicator(
                                progress   = { (value / total).toFloat() },
                                modifier   = Modifier.fillMaxWidth().height(4.dp),
                                color      = catColors[i % catColors.size],
                                trackColor = BorderColor
                            )
                        }
                    }
                }

                // Monthly list
                item {
                    SectionCard("สรุปรายเดือน") {
                        state.chartData.reversed().forEachIndexed { i, month ->
                            if (i > 0) HorizontalDivider(color = BorderColor)
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(month.label, fontSize = 13.sp, color = TextPrimary)
                                Text(fmtTHB(month.spend), fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        shape  = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun MiniBarChart(data: List<ChartMonth>) {
    val maxVal = data.maxOfOrNull { it.spend }?.coerceAtLeast(1.0) ?: 1.0
    Row(Modifier.fillMaxWidth().height(80.dp), verticalAlignment = Alignment.Bottom) {
        data.forEachIndexed { i, month ->
            Column(
                Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(0.7f)
                        .height((64 * (month.spend / maxVal)).dp)
                        .background(
                            if (i == data.lastIndex) Brand500 else Brand500.copy(0.25f),
                            RoundedCornerShape(4.dp)
                        )
                )
                Spacer(Modifier.height(4.dp))
                Text(month.label, fontSize = 8.sp, color = TextSecondary)
            }
        }
    }
}
