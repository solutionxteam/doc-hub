import SwiftUI

struct DocumentsView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var vm   = DocumentsViewModel()
    @State private var showCamera = false

    private let filterChips = [
        ("ทั้งหมด", nil as String?),
        ("ตรวจสอบ", "reviewing"),
        ("อนุมัติ",  "approved"),
        ("ส่งแล้ว", "pushed"),
        ("ผิดพลาด", "failed"),
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchBar
                filterRow
                Divider()
                if vm.isLoading {
                    Spacer()
                    ProgressView().tint(Color.brand500)
                    Spacer()
                } else if vm.documents.isEmpty {
                    emptyState
                } else {
                    docList
                }
            }
            .background(Color(hex: "#f8f9fc"))
            .navigationTitle("เอกสาร")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showCamera = true } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .700))
                            .foregroundColor(Color.brand500)
                    }
                }
            }
            .task {
                guard let orgId = authVM.org?.id else { return }
                await vm.load(orgId: orgId)
            }
            .sheet(isPresented: $showCamera) { CameraPickerView() }
        }
    }

    // MARK: – Search bar
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(Color.textSecondary)
            TextField("ค้นหาชื่อผู้ขาย…", text: $vm.searchText)
                .onChange(of: vm.searchText) { _, q in
                    Task { await vm.search(query: q) }
                }
        }
        .padding(12)
        .background(Color.surface)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.border))
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: – Filter chips
    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(filterChips, id: \.0) { label, status in
                    let active = vm.filterStatus == status
                    Button {
                        hapticLight()
                        Task { await vm.applyFilter(status: status) }
                    } label: {
                        Text(label)
                            .font(.system(size: 13, weight: active ? .700 : .500))
                            .foregroundColor(active ? .white : Color.textSecondary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(active ? Color.brand500 : Color.surface)
                            .cornerRadius(20)
                            .overlay(
                                Capsule().stroke(active ? Color.brand500 : Color.border)
                            )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    // MARK: – List
    private var docList: some View {
        List {
            ForEach(vm.documents) { doc in
                NavigationLink { DocumentDetailView(doc: doc) } label: {
                    DocumentCard(doc: doc)
                }
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "tray.fill")
                .font(.system(size: 48))
                .foregroundColor(Color.border)
            Text("ไม่พบเอกสาร")
                .font(.system(size: 16, weight: .600))
                .foregroundColor(Color.textSecondary)
            Text("ลองเปลี่ยน filter หรือเพิ่มเอกสารใหม่")
                .font(.system(size: 13))
                .foregroundColor(Color.textSecondary)
            Spacer()
        }
    }
}

// MARK: – DocumentCard
struct DocumentCard: View {
    let doc: SlippyDocument

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Icon
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 20))
                    .foregroundColor(Color.brand500)
                    .frame(width: 44, height: 44)
                    .background(Color.brand50)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                // Info
                VStack(alignment: .leading, spacing: 3) {
                    Text(doc.vendorName ?? doc.fileName)
                        .font(.system(size: 14, weight: .700))
                        .foregroundColor(Color.textPrimary)
                        .lineLimit(1)
                    if let inv = doc.invoiceNumber {
                        Text(inv)
                            .font(.system(size: 12))
                            .foregroundColor(Color.textSecondary)
                    }
                    if let cat = doc.category {
                        Text(cat)
                            .font(.system(size: 11))
                            .foregroundColor(Color.brand500)
                    }
                }

                Spacer()

                // Amount + status
                VStack(alignment: .trailing, spacing: 4) {
                    if let amt = doc.totalAmount {
                        Text(fmtTHB(amt))
                            .font(.system(size: 15, weight: .800))
                            .foregroundColor(Color.textPrimary)
                    }
                    StatusBadge(status: doc.status)
                }
            }

            // Confidence bar
            if let conf = doc.overallConfidence {
                HStack(spacing: 6) {
                    Image(systemName: "brain")
                        .font(.system(size: 10))
                        .foregroundColor(Color.textSecondary)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.border).frame(height: 3)
                            Capsule()
                                .fill(conf > 0.9 ? Color.statusApproved : Color.statusReviewing)
                                .frame(width: geo.size.width * conf, height: 3)
                        }
                    }
                    .frame(height: 3)
                    Text("\(Int(conf * 100))%")
                        .font(.system(size: 10, weight: .600))
                        .foregroundColor(Color.textSecondary)
                }
                .padding(.top, 10)
            }
        }
        .padding(14)
        .background(Color.surface)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border))
    }
}
