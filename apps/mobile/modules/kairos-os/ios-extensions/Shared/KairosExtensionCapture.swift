import Foundation

enum KairosExtensionCapture {
  private static let defaults = UserDefaults(suiteName: "group.com.kairos.mobile") ?? .standard

  static func submit(content: String?, url: String?, title: String?, source: String) {
    var pending: [String: Any] = [
      "source": source,
      "capturedAt": ISO8601DateFormatter().string(from: Date()),
    ]
    if let content, !content.isEmpty { pending["content"] = content }
    if let url, !url.isEmpty { pending["url"] = url }
    if let title, !title.isEmpty { pending["title"] = title }
    defaults.set(pending, forKey: "pendingCapture")

    guard
      let token = defaults.string(forKey: "authToken"),
      let base = defaults.string(forKey: "apiBaseUrl"),
      !token.isEmpty,
      !base.isEmpty
    else {
      return
    }

    var request = URLRequest(url: URL(string: "\(base)/capture")!)
    request.httpMethod = "POST"
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: pending)
    let semaphore = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: request) { _, response, _ in
      if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
        defaults.removeObject(forKey: "pendingCapture")
      }
      semaphore.signal()
    }.resume()
    _ = semaphore.wait(timeout: .now() + 8)
  }
}
