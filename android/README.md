# Slippy Android — Native Kotlin / Jetpack Compose App

Native Android app built with **Kotlin + Jetpack Compose + Hilt + Supabase Kotlin SDK**

## Requirements
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34
- Min Android: API 26 (Android 8.0)

## Quick Start

```bash
# Open in Android Studio
# File → Open → select /android folder

# Or build from CLI
cd android
./gradlew assembleDebug

# Install on connected device/emulator
./gradlew installDebug
```

## Architecture

```
app/src/main/java/app/slippy/
├── SlippyApp.kt              # @HiltAndroidApp Application
├── MainActivity.kt           # @AndroidEntryPoint, Compose entry
├── data/
│   ├── Config.kt             # Supabase URL + keys
│   ├── models/Document.kt    # @Serializable data classes
│   ├── supabase/
│   │   └── SupabaseModule.kt # Hilt DI module
│   └── repository/
│       ├── AuthRepository.kt
│       └── DocumentRepository.kt
├── ui/
│   ├── theme/
│   │   ├── Color.kt          # Brand + status colors
│   │   ├── Theme.kt          # MaterialTheme setup
│   │   └── Type.kt           # Typography
│   ├── navigation/
│   │   └── AppNavigation.kt  # NavHost + BottomNav
│   ├── auth/
│   │   ├── LoginScreen.kt    # Dark gradient login
│   │   └── LoginViewModel.kt
│   ├── dashboard/
│   │   ├── DashboardScreen.kt
│   │   └── DashboardViewModel.kt
│   ├── documents/
│   │   ├── DocumentsScreen.kt
│   │   ├── DocumentsViewModel.kt
│   │   ├── CameraScreen.kt   # Gallery + Camera + PDF picker
│   │   └── CameraViewModel.kt
│   ├── analytics/
│   │   ├── AnalyticsScreen.kt
│   │   └── AnalyticsViewModel.kt
│   └── profile/
│       ├── ProfileScreen.kt  # With biometric toggle
│       └── ProfileViewModel.kt
└── utils/
    └── Formatters.kt         # fmtTHB, relTime, statusLabel
```

## Key Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| Jetpack Compose BOM | 2024.06 | UI framework |
| Hilt | 2.51.1 | Dependency injection |
| Navigation Compose | 2.7.7 | Screen navigation |
| Supabase BOM | 2.5.4 | Auth + PostgREST + Storage |
| Ktor Android | 2.3.12 | HTTP client for Supabase |
| CameraX | 1.3.4 | Camera capture |
| Coil Compose | 2.6.0 | Image loading |
| Biometric | 1.1.0 | Fingerprint / face unlock |

## Features

| Screen | Features |
|--------|----------|
| **Login** | Email/password, Hilt ViewModel, error display |
| **Dashboard** | Stats cards, quota progress, recent docs list |
| **Documents** | Search + filter chips, confidence bars |
| **Camera** | ActivityResultContracts (gallery + camera), FileProvider |
| **Analytics** | Bar chart, category progress bars, monthly summary |
| **Profile** | Biometric toggle, notification prefs, logout dialog |

## Supabase Config

`app/src/main/java/app/slippy/data/Config.kt` — credentials already set for demo.

## Demo Login
- Email: `demo@slippy.app`
- Password: `Slipify@2025`

## Build Variants
- `debug` — local development, logs enabled
- `release` — minified + resource-shrunk, ready for Play Store
