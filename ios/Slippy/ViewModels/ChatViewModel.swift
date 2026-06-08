import Foundation

/// Talks to the same AI Assistant backend the web app uses
/// (`POST /api/chat` — Claude + Life Graph context, see
/// `web/src/app/api/chat/route.ts`). The endpoint takes
/// `{ messages: [{role, content}], orgId }` and returns `{ message }`,
/// so both platforms get identical, context-aware responses from one
/// shared brain — only the UI differs.
@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var draft = ""
    @Published var isSending = false
    @Published var error: String?

    private let endpoint = Config.webAppURL.appendingPathComponent("api/chat")

    func send(orgId: String?) async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }

        let userMsg = ChatMessage(role: .user, content: text)
        messages.append(userMsg)
        draft = ""
        isSending = true
        defer { isSending = false }

        do {
            var req = URLRequest(url: endpoint)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")

            struct Payload: Encodable {
                let messages: [Wire]
                let orgId: String?
                struct Wire: Encodable { let role: String; let content: String }
            }
            let payload = Payload(
                messages: messages.map { .init(role: $0.role.rawValue, content: $0.content) },
                orgId: orgId
            )
            req.httpBody = try JSONEncoder().encode(payload)

            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw URLError(.badServerResponse)
            }

            struct Reply: Decodable { let message: String }
            let reply = try JSONDecoder().decode(Reply.self, from: data)
            messages.append(ChatMessage(role: .assistant, content: reply.message))
        } catch {
            messages.append(ChatMessage(
                role: .assistant,
                content: "ขอโทษครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่หรือติดต่อ support@slippy.app"
            ))
            self.error = error.localizedDescription
        }
    }

    func seedGreeting() {
        guard messages.isEmpty else { return }
        messages.append(ChatMessage(
            role: .assistant,
            content: "สวัสดีครับ 👋 ผมคือ Slippy AI ผู้ช่วยส่วนตัวด้านการเงิน — ถามอะไรเกี่ยวกับค่าใช้จ่าย ร้านค้า หรือเอกสารของคุณได้เลยครับ"
        ))
    }
}
