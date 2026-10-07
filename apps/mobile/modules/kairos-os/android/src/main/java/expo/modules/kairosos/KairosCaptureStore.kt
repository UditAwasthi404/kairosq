package expo.modules.kairosos

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.io.BufferedReader
import java.io.DataOutputStream
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Shared auth + pending-capture store used by the share target, widget,
 * and keyboard. Content is transmitted only after an explicit Kairos action.
 */
class KairosCaptureStore(private val context: Context) {
  private val prefs: SharedPreferences =
    context.getSharedPreferences("kairos_os_prefs", Context.MODE_PRIVATE)

  var apiBaseUrl: String
    get() = prefs.getString("apiBaseUrl", "") ?: ""
    set(value) = prefs.edit().putString("apiBaseUrl", value.trimEnd('/')).apply()

  var authToken: String?
    get() = prefs.getString("authToken", null)
    set(value) {
      prefs.edit().putString("authToken", value).apply()
    }

  var insightText: String
    get() = prefs.getString("insightText", "Capture something and Kairos will find patterns.")
      ?: "Capture something and Kairos will find patterns."
    set(value) = prefs.edit().putString("insightText", value).apply()

  fun setPending(payload: JSONObject) {
    prefs.edit().putString("pendingCapture", payload.toString()).apply()
  }

  fun getPending(): JSONObject? {
    val raw = prefs.getString("pendingCapture", null) ?: return null
    return try {
      JSONObject(raw)
    } catch (_: Exception) {
      null
    }
  }

  fun clearPending() {
    prefs.edit().remove("pendingCapture").apply()
  }

  data class SubmitResult(
    val ok: Boolean,
    val queued: Boolean,
    val error: String?,
    val observationId: String? = null,
  )

  fun submitText(
    content: String,
    source: String,
    url: String? = null,
    title: String? = null,
  ): SubmitResult {
    val payload = JSONObject().apply {
      put("content", content)
      put("source", source)
      put("capturedAt", isoNow())
      if (!url.isNullOrBlank()) put("url", url)
      if (!title.isNullOrBlank()) put("title", title)
    }
    setPending(payload)
    val token = authToken
    val base = apiBaseUrl
    if (token.isNullOrBlank() || base.isBlank()) {
      val queued = SubmitResult(ok = false, queued = true, error = "Saved on this device. Will sync when you're online.")
      KairosUploadNotifier.notifySubmit(context, queued)
      return queued
    }
    return try {
      val urlObj = URL("$base/capture")
      val conn = (urlObj.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 30_000
        doOutput = true
        setRequestProperty("Authorization", "Bearer $token")
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Accept", "application/json")
      }
      val body = OutputWriter.write(conn, payload.toString())
      val code = conn.responseCode
      conn.disconnect()
      val result = if (code in 200..299) {
        clearPending()
        SubmitResult(ok = true, queued = false, error = null, observationId = parseObservationId(body))
      } else {
        SubmitResult(ok = false, queued = true, error = "Server returned $code")
      }
      KairosUploadNotifier.notifySubmit(context, result)
      result
    } catch (error: Exception) {
      val queued = SubmitResult(ok = false, queued = true, error = error.message)
      KairosUploadNotifier.notifySubmit(context, queued)
      queued
    }
  }

  fun submitFile(file: File, mimeType: String, source: String, title: String?): SubmitResult {
    val token = authToken
    val base = apiBaseUrl
    val pending = JSONObject().apply {
      put("source", source)
      put("fileUri", "file://${file.absolutePath}")
      put("fileName", file.name)
      put("mimeType", mimeType)
      if (!title.isNullOrBlank()) put("title", title)
    }
    setPending(pending)
    if (token.isNullOrBlank() || base.isBlank()) {
      val queued = SubmitResult(ok = false, queued = true, error = "Saved on this device. Will sync when you're online.")
      KairosUploadNotifier.notifySubmit(context, queued)
      return queued
    }
    return try {
      val boundary = "Kairos${UUID.randomUUID().toString().replace("-", "")}"
      val conn = (URL("$base/capture/upload").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 20_000
        readTimeout = 45_000
        doOutput = true
        setRequestProperty("Authorization", "Bearer $token")
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
      }
      DataOutputStream(conn.outputStream).use { out ->
        fun field(name: String, value: String) {
          out.writeBytes("--$boundary\r\n")
          out.writeBytes("Content-Disposition: form-data; name=\"$name\"\r\n\r\n")
          out.writeBytes("$value\r\n")
        }
        field("source", source)
        if (!title.isNullOrBlank()) field("title", title)
        out.writeBytes("--$boundary\r\n")
        out.writeBytes(
          "Content-Disposition: form-data; name=\"file\"; filename=\"${file.name}\"\r\n",
        )
        out.writeBytes("Content-Type: $mimeType\r\n\r\n")
        out.write(file.readBytes())
        out.writeBytes("\r\n--$boundary--\r\n")
      }
      val code = conn.responseCode
      val body = try {
        val stream = if (code >= 400) conn.errorStream else conn.inputStream
        stream?.let { BufferedReader(InputStreamReader(it)).use { reader -> reader.readText() } }.orEmpty()
      } catch (_: Exception) {
        ""
      }
      conn.disconnect()
      val result = if (code in 200..299) {
        clearPending()
        SubmitResult(ok = true, queued = false, error = null, observationId = parseObservationId(body))
      } else {
        SubmitResult(ok = false, queued = true, error = "Server returned $code")
      }
      KairosUploadNotifier.notifySubmit(context, result)
      result
    } catch (error: Exception) {
      val queued = SubmitResult(ok = false, queued = true, error = error.message)
      KairosUploadNotifier.notifySubmit(context, queued)
      queued
    }
  }

  private fun parseObservationId(body: String): String? {
    if (body.isBlank()) return null
    return try {
      JSONObject(body).optJSONObject("data")?.optString("id")?.takeIf { it.isNotBlank() }
    } catch (_: Exception) {
      null
    }
  }

  private fun isoNow(): String {
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    format.timeZone = TimeZone.getTimeZone("UTC")
    return format.format(Date())
  }
}

private object OutputWriter {
  fun write(conn: HttpURLConnection, body: String): String {
    conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
    // Drain the stream so OkHttp/HttpURLConnection does not leak.
    return try {
      val stream = if (conn.responseCode >= 400) conn.errorStream else conn.inputStream
      stream?.let { BufferedReader(InputStreamReader(it)).use { reader -> reader.readText() } }.orEmpty()
    } catch (_: Exception) {
      ""
    }
  }
}
