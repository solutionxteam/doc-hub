package app.slippy.utils

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

fun fmtTHB(amount: Double, decimals: Int = 0): String {
    val fmt = NumberFormat.getNumberInstance(Locale("th", "TH"))
    fmt.minimumFractionDigits = decimals
    fmt.maximumFractionDigits = decimals
    return "฿${fmt.format(amount)}"
}

fun relTime(isoString: String): String {
    return try {
        val sdf  = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val date = sdf.parse(isoString.take(19)) ?: return ""
        val diff = (Date().time - date.time) / 1000L
        when {
            diff < 60      -> "เมื่อกี้"
            diff < 3600    -> "${diff / 60} นาทีที่แล้ว"
            diff < 86400   -> "${diff / 3600} ชม.ที่แล้ว"
            diff < 604800  -> "${diff / 86400} วันที่แล้ว"
            else           -> fmtDate(isoString)
        }
    } catch (e: Exception) { "" }
}

fun fmtDate(isoString: String): String = try {
    val input  = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    val output = SimpleDateFormat("d MMM yyyy", Locale("th", "TH"))
    output.format(input.parse(isoString.take(19))!!)
} catch (e: Exception) { isoString }

fun statusLabel(status: String): String = when (status) {
    "pushed"     -> "ส่งแล้ว"
    "approved"   -> "อนุมัติ"
    "reviewing"  -> "ตรวจสอบ"
    "processing" -> "ประมวลผล"
    "failed"     -> "ผิดพลาด"
    else         -> "รอดำเนินการ"
}
