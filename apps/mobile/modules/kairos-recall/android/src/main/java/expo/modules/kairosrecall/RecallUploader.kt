package expo.modules.kairosrecall

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class RecallUploader(private val context: Context) {
  private val prefs: SharedPreferences =
    context.getSharedPreferences("kairos_recall_prefs", Context.MODE_PRIVATE)

  var apiBaseUrl: String
    get() = prefs.getString("apiBaseUrl", "") ?: ""
    set(value) = prefs.edit().putString("apiBaseUrl", value.trimEnd('/')).apply()

  var authToken: String?
    get() = prefs.getString("authToken", null)
    set(value) {
      prefs.edit().putString("authToken", value).apply()
    }

  var lastUploadAt: Long
    get() = prefs.getLong("lastUploadAt", 0L)
    set(value) = prefs.edit().putLong("lastUploadAt", value).apply()

  var lastError: String?
    get() = prefs.getString("lastError", null)
    set(value) = prefs.edit().putString("lastError", value).apply()

  var entitlementAllowedCached: Boolean
    get() = prefs.getBoolean("entitlementAllowed", false)
    set(value) = prefs.edit().putBoolean("entitlementAllowed", value).apply()

  /** User wants Recall on until they explicitly turn it off. */
  var userEnabled: Boolean
    get() = prefs.getBoolean("userEnabled", false)
    set(value) = prefs.edit().putBoolean("userEnabled", value).apply()

  fun clearAuthAndErrors() {
    prefs.edit()
      .remove("authToken")
      .remove("lastError")
      .putBoolean("entitlementAllowed", false)
      .putBoolean("userEnabled", false)
      .apply()
  }

  data class UploadOutcome(
    val ok: Boolean,
    val entitlementRequired: Boolean = false,
    val unauthorized: Boolean = false,
    val acknowledgedIds: List<String> = emptyList(),
    val error: String? = null,
  )

  fun uploadBatch(events: List<JSONObject>): UploadOutcome {
    val token = authToken
    val base = apiBaseUrl
    if (token.isNullOrBlank() || base.isBlank()) {
      return UploadOutcome(ok = false, error = "Missing auth token or API base URL")
    }
    if (events.isEmpty()) {
      return UploadOutcome(ok = true)
    }

    return try {
      val url = URL("$base/recall/events")
      val conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 30_000
        doOutput = true
        setRequestProperty("Authorization", "Bearer $token")
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Cache-Control", "no-cache")
      }

      val body = JSONObject().put("events", JSONArray(events.map { stripInternal(it) }))
      OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }

      val code = conn.responseCode
      val stream = if (code in 200..299) conn.inputStream else conn.errorStream
      val responseText = stream?.let { BufferedReader(InputStreamReader(it)).readText() }.orEmpty()

      when (code) {
        in 200..299 -> {
          lastUploadAt = System.currentTimeMillis()
          lastError = null
          val acked = parseAcknowledged(responseText, events)
          RecallUploadNotifier.notifyBatch(context, acked.size)
          UploadOutcome(ok = true, acknowledgedIds = acked)
        }
        401 -> {
          lastError = "Unauthorized"
          UploadOutcome(ok = false, unauthorized = true, error = "Unauthorized")
        }
        403 -> {
          val entitlement = responseText.contains("RECALL_ENTITLEMENT_REQUIRED")
          lastError = if (entitlement) "Recall entitlement required" else "Forbidden"
          entitlementAllowedCached = false
          UploadOutcome(
            ok = false,
            entitlementRequired = entitlement,
            error = lastError,
          )
        }
        429 -> {
          lastError = "Rate limited"
          UploadOutcome(ok = false, error = "Rate limited")
        }
        else -> {
          lastError = "Upload failed ($code)"
          UploadOutcome(ok = false, error = lastError)
        }
      }
    } catch (e: Exception) {
      lastError = e.message ?: "Network error"
      UploadOutcome(ok = false, error = lastError)
    }
  }

  private fun stripInternal(obj: JSONObject): JSONObject {
    val copy = JSONObject(obj.toString())
    copy.remove("enqueuedAt")
    // Drop nulls
    val keys = copy.keys().asSequence().toList()
    for (key in keys) {
      if (copy.isNull(key)) copy.remove(key)
    }
    return copy
  }

  private fun parseAcknowledged(responseText: String, sent: List<JSONObject>): List<String> {
    return try {
      val root = JSONObject(responseText)
      val results = root.optJSONObject("data")?.optJSONArray("results") ?: return sent.map {
        it.optString("clientEventId")
      }.filter { it.isNotBlank() }
      val ids = mutableListOf<String>()
      for (i in 0 until results.length()) {
        val item = results.getJSONObject(i)
        val status = item.optString("status")
        val reason = item.optString("reason")
        when {
          status == "accepted" || status == "deduped" -> {
            ids.add(item.optString("clientEventId"))
          }
          // Permanent rejects leave the outbox; rate-limited ones stay for retry.
          status == "rejected" &&
            !reason.contains("Rate limited", ignoreCase = true) -> {
            ids.add(item.optString("clientEventId"))
          }
        }
      }
      ids.filter { it.isNotBlank() }
    } catch (_: Exception) {
      // If parse fails but HTTP 200, ack all sent to avoid infinite retry of poison payloads.
      sent.map { it.optString("clientEventId") }.filter { it.isNotBlank() }
    }
  }

  companion object {
    val INITIAL_BACKOFF_MS = TimeUnit.SECONDS.toMillis(5)
    val MAX_BACKOFF_MS = TimeUnit.MINUTES.toMillis(10)
  }
}
