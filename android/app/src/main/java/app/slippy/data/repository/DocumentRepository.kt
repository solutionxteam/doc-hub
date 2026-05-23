package app.slippy.data.repository

import app.slippy.data.models.MonthSummary
import app.slippy.data.models.SlippyDocument
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.storage.storage
import io.github.jan.supabase.storage.upload
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DocumentRepository @Inject constructor(
    private val supabase: SupabaseClient
) {
    suspend fun fetchRecent(orgId: String, limit: Int = 20): List<SlippyDocument> =
        supabase.from("documents")
            .select {
                filter { eq("organization_id", orgId) }
                order("created_at", Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList()

    suspend fun fetchFiltered(
        orgId: String,
        status: String? = null,
        query: String?  = null,
        limit: Int      = 50
    ): List<SlippyDocument> =
        supabase.from("documents")
            .select {
                filter {
                    eq("organization_id", orgId)
                    status?.let { eq("status", it) }
                    query?.let { ilike("vendor_name", "%$it%") }
                }
                order("created_at", Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList()

    suspend fun fetchMonthSummaries(orgId: String): List<MonthSummary> =
        supabase.from("monthly_expense_summary")
            .select {
                filter { eq("organization_id", orgId) }
                order("month", Order.ASCENDING)
                limit(12)
            }
            .decodeList()

    suspend fun uploadDocument(
        orgId: String,
        userId: String,
        bytes: ByteArray,
        fileName: String
    ): SlippyDocument {
        // 1. Upload bytes to Supabase Storage (works for both file:// and content:// URIs)
        val storagePath = "$orgId/$fileName"
        val bucket = supabase.storage.from("documents")
        bucket.upload(storagePath, bytes, upsert = false)

        // 2. Create document record
        val doc = mapOf(
            "organization_id" to orgId,
            "file_name"       to fileName,
            "file_path"       to storagePath,
            "status"          to "processing",
            "source"          to "mobile"
        )
        return supabase.from("documents").insert(doc) { select() }.decodeSingle()
    }

    suspend fun updateStatus(docId: String, status: String): SlippyDocument =
        supabase.from("documents")
            .update({ set("status", status) }) {
                filter { eq("id", docId) }
                select()
            }
            .decodeSingle()
}
