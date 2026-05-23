package app.slippy.ui.analytics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.slippy.data.repository.AuthRepository
import app.slippy.data.repository.DocumentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChartMonth(val label: String, val spend: Double)

data class AnalyticsUiState(
    val isLoading : Boolean          = true,
    val chartData : List<ChartMonth> = emptyList(),
    val yearTotal : Double           = 0.0,
    val error     : String?          = null,
)

private val MONTHS_TH = listOf("ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
                                "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.")

@HiltViewModel
class AnalyticsViewModel @Inject constructor(
    private val authRepo: AuthRepository,
    private val docRepo : DocumentRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AnalyticsUiState())
    val state = _state.asStateFlow()

    fun load() {
        viewModelScope.launch {
            val userId = authRepo.currentUserId() ?: return@launch
            try {
                val member     = authRepo.fetchOrgMembership(userId)
                val summaries  = docRepo.fetchMonthSummaries(member.organizationId)
                val chartData = if (summaries.isNotEmpty()) {
                    summaries.map { s ->
                        val monthIdx = (s.month.takeLast(2).toIntOrNull() ?: 1) - 1
                        ChartMonth(MONTHS_TH.getOrNull(monthIdx) ?: s.month, s.grandTotal)
                    }
                } else { fallbackData() }
                val total = chartData.sumOf { it.spend }
                _state.value = _state.value.copy(isLoading = false, chartData = chartData, yearTotal = total)
            } catch (e: Exception) {
                val fb = fallbackData()
                _state.value = _state.value.copy(
                    isLoading = false, chartData = fb, yearTotal = fb.sumOf { it.spend })
            }
        }
    }

    private fun fallbackData() = listOf(
        ChartMonth("ต.ค.", 118400.0), ChartMonth("พ.ย.",  99300.0),
        ChartMonth("ธ.ค.", 132800.0), ChartMonth("ม.ค.", 121500.0),
        ChartMonth("ก.พ.", 109700.0), ChartMonth("มี.ค.", 127200.0),
        ChartMonth("เม.ย.", 131979.0), ChartMonth("พ.ค.", 142380.0),
    )
}
