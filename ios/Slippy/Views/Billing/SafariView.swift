import SwiftUI
import SafariServices

/// Thin wrapper presenting an in-app browser sheet — used to host
/// Stripe Checkout / Customer-Portal flows (which must be created
/// server-side with secret keys) without leaving the app context.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = false
        let vc = SFSafariViewController(url: url, configuration: config)
        vc.preferredControlTintColor = UIColor(Color.brand500)
        return vc
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
