import UIKit

@objc(KeyboardViewController)
final class KeyboardViewController: UIInputViewController {
  private var shiftOn = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.07, green: 0.09, blue: 0.12, alpha: 1)
    buildKeyboard()
  }

  private func buildKeyboard() {
    view.subviews.forEach { $0.removeFromSuperview() }
    let stack = UIStackView()
    stack.axis = .vertical
    stack.spacing = 6
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 6),
      stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -6),
      stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
      stack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -8),
    ])

    stack.addArrangedSubview(actionRow())
    let rows = [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["⇧", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
      ["space", ".", "↵"],
    ]
    for row in rows {
      stack.addArrangedSubview(keyRow(row))
    }
  }

  private func actionRow() -> UIStackView {
    let row = UIStackView()
    row.axis = .horizontal
    row.distribution = .fillEqually
    row.spacing = 6
    row.addArrangedSubview(makeButton("Kairos", action: #selector(openCapture)))
    row.addArrangedSubview(makeButton("Save", action: #selector(saveCurrentInput)))
    row.addArrangedSubview(makeButton("Ask", action: #selector(openAsk)))
    return row
  }

  private func keyRow(_ keys: [String]) -> UIStackView {
    let row = UIStackView()
    row.axis = .horizontal
    row.distribution = .fillEqually
    row.spacing = 4
    for key in keys {
      row.addArrangedSubview(makeButton(display(key), action: #selector(tapKey(_:)), key: key))
    }
    return row
  }

  private func display(_ key: String) -> String {
    if key.count == 1 && key != "⇧" && !shiftOn {
      return key.lowercased()
    }
    return key
  }

  private func makeButton(_ title: String, action: Selector, key: String? = nil) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(.white, for: .normal)
    button.backgroundColor = UIColor(white: 0.18, alpha: 1)
    button.layer.cornerRadius = 6
    button.addTarget(self, action: action, for: .touchUpInside)
    if let key {
      button.accessibilityIdentifier = key
    }
    return button
  }

  @objc private func tapKey(_ sender: UIButton) {
    let key = sender.accessibilityIdentifier ?? sender.title(for: .normal) ?? ""
    switch key {
    case "⇧":
      shiftOn.toggle()
      buildKeyboard()
    case "⌫":
      textDocumentProxy.deleteBackward()
    case "↵":
      textDocumentProxy.insertText("\n")
    case "space":
      textDocumentProxy.insertText(" ")
    default:
      let value = shiftOn ? key.uppercased() : key.lowercased()
      textDocumentProxy.insertText(value)
      if shiftOn {
        shiftOn = false
        buildKeyboard()
      }
    }
  }

  @objc private func saveCurrentInput() {
    let before = textDocumentProxy.documentContextBeforeInput ?? ""
    let after = textDocumentProxy.documentContextAfterInput ?? ""
    let text = (before + after).trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { return }
    KairosExtensionCapture.submit(content: text, url: nil, title: nil, source: "KEYBOARD")
  }

  @objc private func openCapture() {
    openURL(URL(string: "kairos://capture?source=KEYBOARD")!)
  }

  @objc private func openAsk() {
    openURL(URL(string: "kairos://ask")!)
  }

  private func openURL(_ url: URL) {
    var responder: UIResponder? = self
    while let current = responder {
      if let application = current as? UIApplication {
        application.open(url)
        return
      }
      responder = current.next
    }
  }
}
