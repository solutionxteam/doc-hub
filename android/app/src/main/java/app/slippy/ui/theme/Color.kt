package app.slippy.ui.theme

import androidx.compose.ui.graphics.Color

// Brand – Indigo
val Brand50  = Color(0xFFEEF2FF)
val Brand100 = Color(0xFFE0E7FF)
val Brand400 = Color(0xFF818CF8)
val Brand500 = Color(0xFF6366F1)
val Brand600 = Color(0xFF4F46E5)
val Brand700 = Color(0xFF4338CA)
val Brand900 = Color(0xFF312E81)

// Status
val StatusPending    = Color(0xFF94A3B8)
val StatusProcessing = Color(0xFF3B82F6)
val StatusReviewing  = Color(0xFFF59E0B)
val StatusApproved   = Color(0xFF10B981)
val StatusPushed     = Color(0xFF8B5CF6)
val StatusFailed     = Color(0xFFEF4444)

// Surface
val SurfaceWhite  = Color(0xFFFFFFFF)
val SurfaceMuted  = Color(0xFFF4F4F6)
val BorderColor   = Color(0xFFE5E7EB)
val TextPrimary   = Color(0xFF111827)
val TextSecondary = Color(0xFF6B7280)
val Background    = Color(0xFFF8F9FC)

// Dark background shades
val DarkBg    = Color(0xFF080C1A)
val DarkCard  = Color(0xFF0E1527)

fun statusColor(status: String): Color = when (status) {
    "pushed"     -> StatusPushed
    "approved"   -> StatusApproved
    "reviewing"  -> StatusReviewing
    "processing" -> StatusProcessing
    "failed"     -> StatusFailed
    else         -> StatusPending
}
