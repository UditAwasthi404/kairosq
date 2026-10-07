import ExpoModulesCore
import Foundation

public class KairosOsModule: Module {
  private let defaults = UserDefaults(suiteName: "group.com.kairos.mobile") ?? .standard

  public func definition() -> ModuleDefinition {
    Name("KairosOs")

    AsyncFunction("setAuthToken") { (token: String?) in
      self.defaults.set(token, forKey: "authToken")
    }

    AsyncFunction("setApiBaseUrl") { (url: String) in
      self.defaults.set(url.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forKey: "apiBaseUrl")
    }

    AsyncFunction("getPendingCapture") { () -> [String: Any]? in
      return self.defaults.dictionary(forKey: "pendingCapture")
    }

    AsyncFunction("clearPendingCapture") {
      self.defaults.removeObject(forKey: "pendingCapture")
    }

    AsyncFunction("refreshWidget") { (insight: String?) in
      if let insight, !insight.isEmpty {
        self.defaults.set(insight, forKey: "insightText")
      }
      if #available(iOS 14.0, *) {
        KairosOsModule.reloadWidgets()
      }
    }
  }

  @available(iOS 14.0, *)
  private static func reloadWidgets() {
    // WidgetCenter is linked from WidgetKit when the app is prebuilt with the widget extension.
  }
}
