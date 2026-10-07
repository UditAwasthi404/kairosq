package expo.modules.kairosrecall

import android.content.Context
import androidx.security.crypto.EncryptedFile
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.charset.StandardCharsets

/**
 * Temporary encrypted transport buffer — not a memory database.
 */
class EncryptedOutbox(context: Context) {
  private val appContext = context.applicationContext
  private val dir = File(appContext.filesDir, "kairos_recall_outbox").apply { mkdirs() }
  private val indexFile = File(dir, "index.enc")
  private val masterKey = MasterKey.Builder(appContext)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

  companion object {
    const val MAX_EVENTS = 500
    const val MAX_BYTES = 10L * 1024L * 1024L
    const val TTL_MS = 72L * 60L * 60L * 1000L
  }

  @Synchronized
  fun enqueue(event: DerivedRecallEvent): Boolean {
    purgeExpired()
    val events = readAllMutable()
    if (events.length() >= MAX_EVENTS) return false
    val json = eventToJson(event)
    if (estimateBytes(events) + json.toString().length > MAX_BYTES) return false
    events.put(json)
    writeAll(events)
    return true
  }

  @Synchronized
  fun peekBatch(limit: Int = 20): List<JSONObject> {
    purgeExpired()
    val events = readAllMutable()
    val out = mutableListOf<JSONObject>()
    for (i in 0 until minOf(limit, events.length())) {
      out.add(events.getJSONObject(i))
    }
    return out
  }

  @Synchronized
  fun acknowledge(clientEventIds: Collection<String>) {
    if (clientEventIds.isEmpty()) return
    val remove = clientEventIds.toSet()
    val events = readAllMutable()
    val next = JSONArray()
    for (i in 0 until events.length()) {
      val obj = events.getJSONObject(i)
      if (!remove.contains(obj.optString("clientEventId"))) {
        next.put(obj)
      }
    }
    writeAll(next)
  }

  @Synchronized
  fun queuedCount(): Int {
    purgeExpired()
    return readAllMutable().length()
  }

  @Synchronized
  fun clear() {
    writeAll(JSONArray())
    dir.listFiles()?.forEach { file ->
      if (file.name != indexFile.name) file.delete()
    }
  }

  @Synchronized
  private fun purgeExpired() {
    val now = System.currentTimeMillis()
    val events = readAllMutable()
    val next = JSONArray()
    for (i in 0 until events.length()) {
      val obj = events.getJSONObject(i)
      val enqueuedAt = obj.optLong("enqueuedAt", now)
      if (now - enqueuedAt <= TTL_MS) {
        next.put(obj)
      }
    }
    if (next.length() != events.length()) {
      writeAll(next)
    }
  }

  private fun eventToJson(event: DerivedRecallEvent): JSONObject {
    return JSONObject()
      .put("clientEventId", event.clientEventId)
      .put("capturedAt", event.capturedAt)
      .put("sessionId", event.sessionId)
      .put("eventKind", event.eventKind)
      .put("extractedText", event.extractedText)
      .put("fingerprint", event.fingerprint)
      .put("appPackage", event.appPackage)
      .put("appLabel", event.appLabel)
      .put("url", event.url)
      .put("title", event.title)
      .put("ocrConfidence", event.ocrConfidence)
      .put("pipelineVersion", event.pipelineVersion)
      .put("clientProcessingVersion", event.clientProcessingVersion)
      .put("enqueuedAt", System.currentTimeMillis())
  }

  private fun estimateBytes(events: JSONArray): Long {
    var total = 0L
    for (i in 0 until events.length()) {
      total += events.getJSONObject(i).toString().length
    }
    return total
  }

  private fun readAllMutable(): JSONArray {
    if (!indexFile.exists() || indexFile.length() == 0L) return JSONArray()
    return try {
      val encrypted = EncryptedFile.Builder(
        appContext,
        indexFile,
        masterKey,
        EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB,
      ).build()
      encrypted.openFileInput().use { input ->
        val bytes = input.readBytes()
        JSONArray(String(bytes, StandardCharsets.UTF_8))
      }
    } catch (_: Exception) {
      // Corrupt/unreadable — start fresh rather than crash capture.
      JSONArray()
    }
  }

  private fun writeAll(events: JSONArray) {
    if (indexFile.exists()) {
      indexFile.delete()
    }
    val encrypted = EncryptedFile.Builder(
      appContext,
      indexFile,
      masterKey,
      EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB,
    ).build()
    encrypted.openFileOutput().use { output ->
      output.write(events.toString().toByteArray(StandardCharsets.UTF_8))
    }
  }
}
