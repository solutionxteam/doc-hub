import SwiftUI
import Supabase

struct DocumentDetailView: View {
    let doc: SlippyDocument
    @Environment(\.dismiss) private var dismiss
    @State private var confirmAction: String?
    @State private var isActing = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header card
                VStack(spacing: 12) {
                    HStack {
                        Image(systemName: "doc.text.fill")
                            .font(.system(size: 28))
                            .foregroundColor(Color.brand500)
                        Spacer()
                        StatusBadge(status: doc.status)
                    }
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(doc.vendorName ?? "—")
                                .font(.system(size: 20, weight: .heavy))
                                .foregroundColor(Color.textPrimary)
                            if let inv = doc.invoiceNumber {
                                Text("เลขที่: \(inv)")
                                    .font(.system(size: 13))
                                    .foregroundColor(Color.textSecondary)
                            }
                        }
                        Spacer()
                        if let amt = doc.totalAmount {
                            VStack(alignment: .trailing) {
                                Text(fmtTHB(amt))
                                    .font(.system(size: 22, weight: .heavy))
                                    .foregroundColor(Color.textPrimary)
                                if let vat = doc.vatAmount {
                                    Text("VAT \(fmtTHB(vat))")
                                        .font(.system(size: 12))
                                        .foregroundColor(Color.textSecondary)
                                }
                            }
                        }
                    }
                }
                .sectionCard()

                // Details
                VStack(spacing: 0) {
                    infoRow("หมวดหมู่",    doc.category ?? "—")
                    Divider().padding(.leading, 16)
                    infoRow("วันที่เอกสาร", doc.docDate ?? "—")
                    Divider().padding(.leading, 16)
                    infoRow("ยอดก่อน VAT", doc.subtotalAmount.map { fmtTHB($0) } ?? "—")
                    if let wht = doc.whtAmount {
                        Divider().padding(.leading, 16)
                        infoRow("หัก ณ ที่จ่าย (WHT)", fmtTHB(wht))
                    }
                    Divider().padding(.leading, 16)
                    infoRow("ช่องทาง",     doc.source)
                    Divider().padding(.leading, 16)
                    infoRow("อัพโหลดเมื่อ", relTime(doc.createdAt))
                    if let conf = doc.overallConfidence {
                        Divider().padding(.leading, 16)
                        HStack {
                            Text("ความเชื่อมั่น AI")
                                .font(.system(size: 13))
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            confidenceChip(conf)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                }
                .background(Color.surface)
                .cornerRadius(16)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border))

                // Actions
                if doc.status == "reviewing" {
                    HStack(spacing: 12) {
                        actionButton("อนุมัติ", "checkmark.circle.fill",
                                     Color.statusApproved, "approved")
                        actionButton("ปฏิเสธ", "xmark.circle.fill",
                                     Color.statusFailed,   "rejected")
                    }
                }

                if doc.status == "approved" {
                    actionButton("ส่งเข้าระบบ", "paperplane.fill",
                                 Color.statusPushed, "pushed")
                }
            }
            .padding(20)
            .padding(.bottom, 40)
        }
        .background(Color(hex: "#f8f9fc"))
        .navigationTitle("รายละเอียดเอกสาร")
        .navigationBarTitleDisplayMode(.inline)
        .alert("ยืนยันการดำเนินการ", isPresented: Binding(
            get: { confirmAction != nil },
            set: { if !$0 { confirmAction = nil } }
        )) {
            Button("ยืนยัน", role: .destructive) {
                if let action = confirmAction {
                    Task { await performAction(action) }
                }
                confirmAction = nil
            }
            Button("ยกเลิก", role: .cancel) { confirmAction = nil }
        } message: {
            if let action = confirmAction {
                Text(action == "approved" ? "อนุมัติเอกสารนี้?" :
                     action == "rejected" ? "ปฏิเสธเอกสารนี้?" : "ส่งเอกสารเข้าระบบ?")
            }
        }
    }

    // MARK: – Confidence chip
    @ViewBuilder
    private func confidenceChip(_ conf: Double) -> some View {
        let pct = Int(conf * 100)
        let color: Color = conf >= 0.85 ? .statusApproved : conf >= 0.60 ? .statusReviewing : .statusFailed
        Text("\(pct)%")
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(color)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    @ViewBuilder
    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13))
                .foregroundColor(Color.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color.textPrimary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func actionButton(_ label: String, _ icon: String,
                               _ color: Color, _ action: String) -> some View {
        Button {
            hapticMedium()
            confirmAction = action
        } label: {
            HStack {
                if isActing {
                    ProgressView().tint(.white).scaleEffect(0.8)
                } else {
                    Image(systemName: icon)
                    Text(label).font(.system(size: 15, weight: .bold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundColor(.white)
            .background(isActing ? color.opacity(0.6) : color)
            .cornerRadius(14)
        }
        .disabled(isActing)
    }

    // MARK: – API call
    @MainActor
    private func performAction(_ action: String) async {
        isActing = true
        do {
            try await SupabaseManager.shared.client
                .from("documents")
                .update(["status": action])
                .eq("id", value: doc.id)
                .execute()
            hapticSuccess()
            dismiss()
        } catch {
            hapticLight()
        }
        isActing = false
    }
}

#if DEBUG
#Preview {
    let doc = SlippyDocument(
        id: "doc-001",
        organizationId: "demo-org",
        vendorName: "บริษัท ซัพพลายเออร์ จำกัด",
        invoiceNumber: "INV-2026-0042",
        docDate: "2026-05-15",
        totalAmount: 53500.00,
        vatAmount: 3500.00,
        whtAmount: 535.00,
        subtotalAmount: 50000.00,
        status: "reviewing",
        source: "mobile",
        docType: "invoice",
        overallConfidence: 0.91,
        category: "วัตถุดิบ",
        filePath: "demo-org/invoice_042.jpg",
        createdAt: "2026-05-16T08:30:00Z"
    )
    return NavigationStack {
        DocumentDetailView(doc: doc)
    }
}
#endif
