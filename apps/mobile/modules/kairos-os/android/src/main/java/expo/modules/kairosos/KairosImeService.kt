package expo.modules.kairosos

import android.content.Intent
import android.inputmethodservice.InputMethodService
import android.net.Uri
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * Real Android IME. Keystrokes stay on-device.
 * Content is sent to Kairos only when the user taps Save.
 */
class KairosImeService : InputMethodService() {
  private var shift = false

  override fun onCreateInputView(): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(0xFF111827.toInt())
      setPadding(10, 10, 10, 16)
    }

    root.addView(actionBar())
    root.addView(privacyNote())

    val rows = listOf(
      listOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
      listOf("a", "s", "d", "f", "g", "h", "j", "k", "l"),
      listOf("⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"),
      listOf("123", ",", "space", ".", "↵"),
    )
    for (row in rows) {
      root.addView(keyRow(row))
    }
    return root
  }

  private fun actionBar(): LinearLayout {
    val bar = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    bar.addView(actionButton("Kairos") { openDeepLink("kairos://capture?source=KEYBOARD") })
    bar.addView(actionButton("Save") { saveCurrentInput() })
    bar.addView(actionButton("Ask") { openDeepLink("kairos://ask") })
    return bar
  }

  private fun privacyNote(): TextView {
    return TextView(this).apply {
      text = "Save sends this field only. Kairos does not collect keystrokes."
      setTextColor(0xFF9AA4B2.toInt())
      textSize = 11f
      setPadding(6, 4, 6, 8)
    }
  }

  private fun keyRow(keys: List<String>): LinearLayout {
    val row = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    for (key in keys) {
      val button = Button(this).apply {
        text = displayKey(key)
        textSize = 14f
        isAllCaps = false
        setOnClickListener { handleKey(key) }
        layoutParams = LinearLayout.LayoutParams(
          if (key == "space") 0 else LinearLayout.LayoutParams.WRAP_CONTENT,
          96,
        ).apply {
          if (key == "space") weight = 1f
          marginStart = 3
          marginEnd = 3
        }
      }
      row.addView(button)
    }
    return row
  }

  private fun actionButton(label: String, onClick: () -> Unit): Button {
    return Button(this).apply {
      text = label
      isAllCaps = false
      textSize = 13f
      setOnClickListener { onClick() }
      layoutParams = LinearLayout.LayoutParams(0, 88).apply { weight = 1f }
    }
  }

  private fun displayKey(key: String): String {
    return when (key) {
      "space" -> "space"
      "⇧" -> "shift"
      "⌫" -> "del"
      "↵" -> "return"
      else -> if (shift && key.length == 1) key.uppercase() else key
    }
  }

  private fun handleKey(key: String) {
    val ic = currentInputConnection ?: return
    when (key) {
      "⇧" -> {
        shift = !shift
        setInputView(onCreateInputView())
      }
      "⌫" -> ic.deleteSurroundingText(1, 0)
      "↵" -> ic.sendKeyEvent(
        android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_ENTER),
      )
      "space" -> ic.commitText(" ", 1)
      "123" -> ic.commitText("1", 1)
      else -> {
        val value = if (shift) key.uppercase() else key
        ic.commitText(value, 1)
        if (shift) {
          shift = false
          setInputView(onCreateInputView())
        }
      }
    }
  }

  private fun saveCurrentInput() {
    val ic = currentInputConnection
    if (ic == null) {
      Toast.makeText(this, "Nothing to save.", Toast.LENGTH_SHORT).show()
      return
    }
    val extracted = ic.getExtractedText(android.view.inputmethod.ExtractedTextRequest(), 0)
    val text = extracted?.text?.toString()?.trim().orEmpty().ifBlank {
      ic.getTextBeforeCursor(4000, 0)?.toString()?.trim().orEmpty()
    }
    if (text.isBlank()) {
      Toast.makeText(this, "Type something first, then tap Save.", Toast.LENGTH_SHORT).show()
      return
    }
    val result = KairosCaptureStore(applicationContext).submitText(text, "KEYBOARD")
    val message = when {
      result.ok -> "Saved to Kairos ✓"
      result.queued -> "Saved on this device. Will sync when you're online."
      else -> result.error ?: "Could not save to Kairos"
    }
    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
  }

  private fun openDeepLink(uri: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    startActivity(intent)
  }

  override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
    super.onStartInput(attribute, restarting)
    // Intentionally do not read or transmit field contents here.
  }
}
