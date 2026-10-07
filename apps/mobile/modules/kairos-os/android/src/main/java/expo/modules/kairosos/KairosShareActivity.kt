package expo.modules.kairosos

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Parcelable
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream

class KairosShareActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val incoming = intent
    Thread {
      try {
        handleShare(incoming)
      } catch (error: Exception) {
        runOnUiThread {
          Toast.makeText(
            this,
            error.message?.take(80) ?: "Kairos could not save that share.",
            Toast.LENGTH_LONG,
          ).show()
        }
      } finally {
        runOnUiThread { finish() }
      }
    }.start()
  }

  private fun handleShare(intent: Intent?) {
    if (intent == null) {
      toast("Kairos could not read that share.")
      return
    }

    val action = intent.action
    if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) {
      toast("Kairos could not read that share.")
      return
    }

    val store = KairosCaptureStore(applicationContext)
    val title = intent.getStringExtra(Intent.EXTRA_SUBJECT)
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)
    val streams = collectUris(intent)
    val mime = intent.type

    val result = if (streams.isNotEmpty()) {
      var last = KairosCaptureStore.SubmitResult(false, false, "Nothing to save to Kairos.")
      for (uri in streams) {
        val copied = copyUri(uri, mime)
        if (copied == null) {
          toast("Kairos could not read the shared screenshot.")
          return
        }
        last = store.submitFile(
          copied.first,
          copied.second,
          "SHARE",
          title ?: copied.first.name,
        )
      }
      last
    } else if (!text.isNullOrBlank()) {
      val url = if (looksLikeUrl(text)) text.trim() else null
      val content = if (url != null) null else text.trim()
      store.submitText(content ?: "", "SHARE", url, title)
    } else {
      toast("Nothing to save to Kairos.")
      return
    }

    val message = when {
      result.ok -> "Saved to Kairos ✓"
      result.queued -> "Saved on this device. Will sync when you're online."
      else -> result.error ?: "Kairos could not save that share."
    }
    toast(message)
  }

  private fun collectUris(intent: Intent): List<Uri> {
    val found = LinkedHashSet<Uri>()
    if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
      parcelableList(intent, Intent.EXTRA_STREAM).forEach { found.add(it) }
    } else {
      parcelableUri(intent, Intent.EXTRA_STREAM)?.let { found.add(it) }
    }
    intent.clipData?.let { clip ->
      for (index in 0 until clip.itemCount) {
        clip.getItemAt(index).uri?.let { found.add(it) }
      }
    }
    intent.data?.let { found.add(it) }
    return found.toList()
  }

  private fun parcelableUri(intent: Intent, key: String): Uri? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(key, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(key)
    }
  }

  private fun parcelableList(intent: Intent, key: String): List<Uri> {
    val raw = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableArrayListExtra(key, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableArrayListExtra<Parcelable>(key)
    }
    return raw?.mapNotNull { it as? Uri } ?: emptyList()
  }

  private fun copyUri(uri: Uri, mime: String?): Pair<File, String>? {
    return try {
      try {
        contentResolver.takePersistableUriPermission(
          uri,
          Intent.FLAG_GRANT_READ_URI_PERMISSION,
        )
      } catch (_: Exception) {
        // Share intents usually give a one-shot grant. That is enough.
      }
      val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
      if (bytes.isEmpty()) return null
      val sniffed = sniff(bytes, mime, uri)
      val dest = File(cacheDir, "share-${System.currentTimeMillis()}${sniffed.extension}")
      FileOutputStream(dest).use { it.write(bytes) }
      Pair(dest, sniffed.mimeType)
    } catch (_: Exception) {
      null
    }
  }

  private data class Sniff(val mimeType: String, val extension: String)

  private fun sniff(bytes: ByteArray, mime: String?, uri: Uri): Sniff {
    if (bytes.size >= 8 &&
      bytes[0] == 0x89.toByte() &&
      bytes[1] == 0x50.toByte() &&
      bytes[2] == 0x4e.toByte() &&
      bytes[3] == 0x47.toByte()
    ) {
      return Sniff("image/png", ".png")
    }
    if (bytes.size >= 3 &&
      bytes[0] == 0xff.toByte() &&
      bytes[1] == 0xd8.toByte() &&
      bytes[2] == 0xff.toByte()
    ) {
      return Sniff("image/jpeg", ".jpg")
    }
    if (bytes.size >= 12 &&
      bytes.copyOfRange(0, 4).toString(Charsets.US_ASCII) == "RIFF" &&
      bytes.copyOfRange(8, 12).toString(Charsets.US_ASCII) == "WEBP"
    ) {
      return Sniff("image/webp", ".webp")
    }
    if (bytes.size >= 4 && bytes.copyOfRange(0, 4).toString(Charsets.US_ASCII) == "%PDF") {
      return Sniff("application/pdf", ".pdf")
    }
    val path = uri.lastPathSegment?.lowercase().orEmpty()
    val declared = mime?.lowercase().orEmpty()
    return when {
      declared.contains("png") || path.endsWith(".png") -> Sniff("image/png", ".png")
      declared.contains("webp") || path.endsWith(".webp") -> Sniff("image/webp", ".webp")
      declared.contains("gif") || path.endsWith(".gif") -> Sniff("image/gif", ".gif")
      declared.contains("pdf") || path.endsWith(".pdf") -> Sniff("application/pdf", ".pdf")
      declared.contains("jpeg") || declared.contains("jpg") || path.endsWith(".jpg") || path.endsWith(".jpeg") ->
        Sniff("image/jpeg", ".jpg")
      declared.startsWith("image/") -> Sniff("image/png", ".png")
      else -> Sniff(if (declared.isNotBlank() && !declared.contains("*")) declared else "image/png", ".png")
    }
  }

  private fun looksLikeUrl(value: String): Boolean {
    val trimmed = value.trim()
    return trimmed.startsWith("http://") || trimmed.startsWith("https://")
  }

  private fun toast(message: String) {
    runOnUiThread {
      Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
  }
}
