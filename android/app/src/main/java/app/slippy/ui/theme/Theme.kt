package app.slippy.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary           = Brand500,
    onPrimary         = Color.White,
    primaryContainer  = Brand100,
    onPrimaryContainer = Brand700,
    secondary         = Brand400,
    onSecondary       = Color.White,
    surface           = SurfaceWhite,
    onSurface         = TextPrimary,
    surfaceVariant    = SurfaceMuted,
    onSurfaceVariant  = TextSecondary,
    background        = Background,
    onBackground      = TextPrimary,
    outline           = BorderColor,
    error             = StatusFailed,
    onError           = Color.White,
)

@Composable
fun SlippyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography  = SlippyTypography,
        content     = content
    )
}
