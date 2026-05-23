import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Label("แดชบอร์ด", systemImage: "square.grid.2x2")
                }
                .tag(0)

            DocumentsView()
                .tabItem {
                    Label("เอกสาร", systemImage: "doc.text")
                }
                .tag(1)

            CameraPickerView()
                .tabItem {
                    Label("สแกน", systemImage: "camera.viewfinder")
                }
                .tag(2)

            AnalyticsView()
                .tabItem {
                    Label("รายงาน", systemImage: "chart.bar")
                }
                .tag(3)

            ProfileView()
                .tabItem {
                    Label("โปรไฟล์", systemImage: "person.circle")
                }
                .tag(4)
        }
        .tint(Color.brand500)
    }
}
