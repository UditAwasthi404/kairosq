import SwiftUI
import WidgetKit

struct KairosEntry: TimelineEntry {
  let date: Date
  let insight: String
}

struct KairosProvider: TimelineProvider {
  func placeholder(in context: Context) -> KairosEntry {
    KairosEntry(date: Date(), insight: "Capture something and Kairos will find patterns.")
  }

  func getSnapshot(in context: Context, completion: @escaping (KairosEntry) -> Void) {
    completion(current())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<KairosEntry>) -> Void) {
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
    completion(Timeline(entries: [current()], policy: .after(next)))
  }

  private func current() -> KairosEntry {
    let defaults = UserDefaults(suiteName: "group.com.kairos.mobile")
    let insight = defaults?.string(forKey: "insightText")
      ?? "Capture something and Kairos will find patterns."
    return KairosEntry(date: Date(), insight: insight)
  }
}

struct KairosWidgetView: View {
  var entry: KairosEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 8) {
        Circle()
          .fill(Color(red: 0.77, green: 0.65, blue: 0.45))
          .frame(width: 7, height: 7)
        Text("KAIROS")
          .font(.system(size: 10, weight: .medium, design: .default))
          .tracking(2.4)
          .foregroundStyle(Color(red: 0.54, green: 0.51, blue: 0.45))
      }

      Text("Something I noticed")
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(Color(red: 0.77, green: 0.65, blue: 0.45))
        .padding(.top, 14)

      Text(entry.insight)
        .font(.system(size: 16, weight: .regular))
        .foregroundStyle(Color(red: 0.96, green: 0.94, blue: 0.90))
        .lineLimit(3)
        .lineSpacing(3)
        .padding(.top, 6)

      Spacer(minLength: 10)

      HStack(spacing: 8) {
        Link(destination: URL(string: "kairos://capture?source=WIDGET")!) {
          Text("Capture")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Color(red: 0.91, green: 0.88, blue: 0.83))
            .frame(maxWidth: .infinity, minHeight: 34)
            .background(Color(red: 0.11, green: 0.10, blue: 0.08), in: Capsule())
            .overlay(Capsule().stroke(Color(red: 0.23, green: 0.20, blue: 0.17), lineWidth: 1))
        }
        Link(destination: URL(string: "kairos://ask")!) {
          Text("Ask")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Color(red: 0.10, green: 0.08, blue: 0.05))
            .frame(maxWidth: .infinity, minHeight: 34)
            .background(Color(red: 0.77, green: 0.65, blue: 0.45), in: Capsule())
        }
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(URL(string: "kairos://insight"))
    .containerBackground(for: .widget) {
      LinearGradient(
        colors: [
          Color(red: 0.09, green: 0.07, blue: 0.05),
          Color(red: 0.05, green: 0.04, blue: 0.04),
          Color(red: 0.10, green: 0.09, blue: 0.07),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    }
  }
}

@main
struct KairosWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "KairosWidget", provider: KairosProvider()) { entry in
      KairosWidgetView(entry: entry)
    }
    .configurationDisplayName("Kairos")
    .description("Capture, ask, and see today’s insight.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
