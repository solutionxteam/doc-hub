import SwiftUI

struct DocumentDetailView: View {
    let doc: SlippyDocument
    @Environment(\.dismiss) private var dismiss
    @State private var confirmAction: String?

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
                                .font(.system(size: 20, weight: .800))
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
                                    .font(.system(size: 22, weight: .800))
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
                    infoRow("หมวดหมู่",   doc.category ?? "—")
                    Divider().padding(.leading, 16)
                    infoRow("วันที่เอกสาร", doc.docDate ?? "—")
                    Divider().padding(.leading, 16)
                    infoRow("ช่องทาง",     doc.source)
                    Divider().padding(.leading, 16)
                    infoRow("อัพโหลดเมื่อ", relTime(doc.createdAt))
                    if let conf = doc.overallConfidence {
                        Divider().padding(.leading, 16)
                        infoRow("ความเชื่อมั่น AI", "\(Int(conf * 100))%")
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
                                     Color.statusFailed,   "failed")
                    }
                }
            }
            .padding(20)
            .padding(.bottom, 40)
        }
        .background(Color(hex: "#f8f9fc"))
        .navigationTitle("รายละเอียดเอกสาร")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13))
                .foregroundColor(Color.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .600))
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
            // TODO: call update status API
        } label: {
            HStack {
                Image(systemName: icon)
                Text(label).font(.system(size: 15, weight: .700))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundColor(.white)
            .background(color)
            .cornerRadius(14)
        }
    }
}
