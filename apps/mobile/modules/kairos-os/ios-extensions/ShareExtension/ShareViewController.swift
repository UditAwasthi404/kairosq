import MobileCoreServices
import Social
import UIKit
import UniformTypeIdentifiers

@objc(ShareViewController)
final class ShareViewController: UIViewController {
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    handleShare()
  }

  private func handleShare() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
      finish()
      return
    }

    let group = DispatchGroup()
    var content: String?
    var url: String?
    var title: String?

    for item in items {
      title = item.attributedContentText?.string ?? title
      for provider in item.attachments ?? [] {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { value, _ in
            if let value = value as? URL {
              url = value.absoluteString
            }
            group.leave()
          }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { value, _ in
            content = value as? String ?? content
            group.leave()
          }
        }
      }
    }

    group.notify(queue: .main) {
      KairosExtensionCapture.submit(
        content: content,
        url: url,
        title: title,
        source: "SHARE"
      )
      self.finish()
    }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }
}
