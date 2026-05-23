# Slippy iOS — Native SwiftUI App

Native iOS app built with **SwiftUI + Swift Concurrency + Supabase Swift SDK**

## Requirements
- Xcode 15.4+
- iOS 17.0+
- macOS 14 (Sonoma)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) `brew install xcodegen`

## Quick Start

```bash
# 1. Install XcodeGen
brew install xcodegen

# 2. Generate Xcode project
cd ios
xcodegen generate

# 3. Open in Xcode
open Slippy.xcodeproj

# 4. Select your team in Signing & Capabilities
# 5. Run on Simulator or Device (⌘R)
```

## Architecture

```
Slippy/
├── App/
│   ├── SlippyApp.swift       # @main entry point
│   └── Config.swift          # Supabase URL + keys
├── Models/
│   ├── Document.swift        # SlippyDocument + extensions
│   ├── Organization.swift    # Organization, OrganizationMember, MonthSummary
│   └── UserProfile.swift     # UserProfile with initials helper
├── Services/
│   └── SupabaseManager.swift # Singleton Supabase client
├── ViewModels/
│   ├── AuthViewModel.swift   # Auth state, sign in/out
│   ├── DashboardViewModel.swift
│   ├── DocumentsViewModel.swift
│   └── AnalyticsViewModel.swift
├── Views/
│   ├── RootView.swift        # Route to Login or MainTab
│   ├── MainTabView.swift     # Tab bar (5 tabs)
│   ├── Auth/LoginView.swift
│   ├── Dashboard/DashboardView.swift
│   ├── Documents/
│   │   ├── DocumentsView.swift
│   │   ├── DocumentCard.swift
│   │   ├── DocumentDetailView.swift
│   │   └── CameraPickerView.swift  # Camera + Photos + PDF
│   ├── Analytics/AnalyticsView.swift
│   └── Profile/ProfileView.swift   # With Face ID toggle
└── Utils/
    ├── Formatters.swift      # fmtTHB, relTime, calcVAT
    ├── SlippyColors.swift    # Brand + status colors
    └── Extensions.swift      # View modifiers, StatusBadge, haptics
```

## Features

| Screen | Features |
|--------|----------|
| **Login** | Email/password, error state, dark gradient UI |
| **Dashboard** | Stats grid, quota bar, recent docs, pull-to-refresh |
| **Documents** | Search, status filter chips, confidence bar |
| **Camera** | UIImagePickerController, PhotosPicker, file import, upload to Supabase Storage |
| **Analytics** | Bar chart, category breakdown, monthly list |
| **Profile** | Face ID (LocalAuthentication), toggles, logout alert |

## Dependencies (Swift Package Manager)

| Package | Version | Purpose |
|---------|---------|---------|
| `supabase/supabase-swift` | ~2.3.0 | Auth + PostgREST + Storage |

Added automatically by `project.yml` → XcodeGen.

## Supabase Config

`Slippy/App/Config.swift` — credentials already set for the demo project.

## Demo Login
- Email: `demo@slippy.app`
- Password: `Slipify@2025`
