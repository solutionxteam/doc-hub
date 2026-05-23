# Add project specific ProGuard rules here.
# Supabase / Ktor
-keep class io.github.jan.supabase.** { *; }
-keep class io.ktor.** { *; }
-keepattributes *Annotation*
-keepattributes Signature

# Kotlin serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keep,includedescriptorclasses class app.slippy.**$$serializer { *; }
-keepclassmembers class app.slippy.** {
    *** Companion;
}
-keepclasseswithmembers class app.slippy.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Hilt
-keep class dagger.hilt.** { *; }
-keep @dagger.hilt.android.lifecycle.HiltViewModel class * extends androidx.lifecycle.ViewModel { *; }

# Coil
-keep class coil.** { *; }
