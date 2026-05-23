package app.slippy.data.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SlippyDocument(
    val id: String,
    @SerialName("organization_id")    val organizationId: String,
    @SerialName("vendor_name")        val vendorName: String?     = null,
    @SerialName("invoice_number")     val invoiceNumber: String?  = null,
    @SerialName("doc_date")           val docDate: String?        = null,
    @SerialName("total_amount")       val totalAmount: Double?    = null,
    @SerialName("vat_amount")         val vatAmount: Double?      = null,
    @SerialName("net_amount")         val netAmount: Double?      = null,
    val status: String                                            = "pending",
    val source: String                                            = "manual",
    @SerialName("doc_type")           val docType: String?        = null,
    @SerialName("overall_confidence") val overallConfidence: Double? = null,
    val category: String?                                         = null,
    @SerialName("file_name")          val fileName: String        = "",
    @SerialName("file_path")          val filePath: String        = "",
    @SerialName("created_at")         val createdAt: String       = ""
) {
    val statusLabel: String get() = when (status) {
        "pushed"     -> "ส่งแล้ว"
        "approved"   -> "อนุมัติ"
        "reviewing"  -> "ตรวจสอบ"
        "processing" -> "ประมวลผล"
        "failed"     -> "ผิดพลาด"
        else         -> "รอดำเนินการ"
    }
}

@Serializable
data class Organization(
    val id: String,
    val name: String,
    val plan: String,
    @SerialName("doc_quota") val docQuota: Int = 100,
    @SerialName("doc_used")  val docUsed: Int  = 0
) {
    val quotaPercent: Float get() = if (docQuota > 0) docUsed.toFloat() / docQuota else 0f
}

@Serializable
data class UserProfile(
    val id: String,
    val email: String,
    @SerialName("full_name")  val fullName: String?  = null,
    @SerialName("avatar_url") val avatarUrl: String? = null
) {
    val displayName: String get() = fullName ?: email.substringBefore("@")
    val initials: String get() {
        val words = displayName.trim().split(" ").filter { it.isNotBlank() }
        return when {
            words.isEmpty() -> "?"
            words.size == 1 -> words[0].take(1).uppercase()
            else -> (words[0].take(1) + words[1].take(1)).uppercase()
        }
    }
}

@Serializable
data class OrganizationMember(
    val id: String,
    @SerialName("user_id")         val userId: String,
    @SerialName("organization_id") val organizationId: String,
    val role: String,
    @SerialName("joined_at")       val joinedAt: String,
    val organizations: Organization? = null
)

@Serializable
data class MonthSummary(
    val id: String,
    @SerialName("organization_id") val organizationId: String,
    val month: String,
    @SerialName("doc_count")   val docCount: Int    = 0,
    @SerialName("grand_total") val grandTotal: Double = 0.0,
    @SerialName("vat_total")   val vatTotal: Double  = 0.0
)
