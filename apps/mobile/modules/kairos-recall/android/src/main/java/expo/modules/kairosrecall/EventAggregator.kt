package expo.modules.kairosrecall

data class DerivedRecallEvent(
  val clientEventId: String,
  val capturedAt: String,
  val sessionId: String?,
  val eventKind: String = "screen_text",
  val extractedText: String,
  val fingerprint: String,
  val appPackage: String?,
  val appLabel: String?,
  val url: String?,
  val title: String?,
  val ocrConfidence: Double?,
  val pipelineVersion: String,
  val clientProcessingVersion: String,
)

/**
 * Information-preserving aggregation.
 *
 * - DUPLICATE snapshots coalesce (no emit)
 * - RELATED_SCROLL merges line-union into the open buffer (same session)
 * - MATERIAL change flushes the previous buffer as its own event
 *
 * Does NOT use "same app + time window" alone as a merge key.
 */
class EventAggregator(
  private val idleFlushMs: Long = 8_000L,
  private val maxBufferedChars: Int = 32_000,
  private val maxSnapshotsPerBuffer: Int = 16,
) {
  private var open: Buffer? = null

  data class Buffer(
    val sessionId: String,
    val appPackage: String?,
    val appLabel: String?,
    var text: String,
    var fingerprint: String,
    var title: String?,
    var url: String?,
    var ocrConfidence: Double?,
    val startedAtMs: Long,
    var updatedAtMs: Long,
    var snapshotCount: Int = 1,
  )

  fun ingest(
    nowMs: Long,
    text: String,
    appPackage: String?,
    appLabel: String?,
    title: String?,
    url: String?,
    ocrConfidence: Double?,
    forceFlush: Boolean = false,
  ): DerivedRecallEvent? {
    if (forceFlush) {
      return flush(nowMs)
    }

    val cleaned = text.trim()
    if (!TextSemantics.isMeaningful(cleaned)) {
      RecallDiagnostics.eventsDropped += 1
      return null
    }

    val fp = FingerprintUtil.fingerprint(cleaned, appPackage)
    val current = open

    if (current == null) {
      openNew(nowMs, cleaned, fp, appPackage, appLabel, title, url, ocrConfidence)
      return null
    }

    val appChanged = current.appPackage != null &&
      appPackage != null &&
      current.appPackage != appPackage

    if (appChanged) {
      val emitted = flush(nowMs)
      openNew(nowMs, cleaned, fp, appPackage, appLabel, title, url, ocrConfidence)
      return emitted
    }

    val relation = TextSemantics.relation(current.text, cleaned)
    RecallDiagnostics.lastRelation = relation.name

    when (relation) {
      TextSemantics.Relation.DUPLICATE -> {
        RecallDiagnostics.eventsCoalesced += 1
        current.updatedAtMs = nowMs
        if (!title.isNullOrBlank()) current.title = title
        if (!url.isNullOrBlank()) current.url = url
        if (ocrConfidence != null) {
          current.ocrConfidence = averageConfidence(current.ocrConfidence, ocrConfidence)
        }
        return null
      }

      TextSemantics.Relation.RELATED_SCROLL -> {
        // Same page/session with new visible content (scroll / expand).
        RecallDiagnostics.eventsCoalesced += 1
        current.text = TextSemantics.unionLines(current.text, cleaned, maxBufferedChars)
        current.fingerprint = FingerprintUtil.fingerprint(current.text, appPackage)
        current.updatedAtMs = nowMs
        current.snapshotCount += 1
        val betterTitle = title ?: TextSemantics.inferContentTitle(cleaned)
        if (!betterTitle.isNullOrBlank()) {
          val cur = current.title
          if (cur.isNullOrBlank() || betterTitle.length > cur.length) {
            current.title = betterTitle
          }
        }
        if (!url.isNullOrBlank()) current.url = url
        if (ocrConfidence != null) {
          current.ocrConfidence = averageConfidence(current.ocrConfidence, ocrConfidence)
        }
        if (current.text.length >= maxBufferedChars ||
          current.snapshotCount >= maxSnapshotsPerBuffer
        ) {
          return flush(nowMs)
        }
        return null
      }

      TextSemantics.Relation.MATERIAL -> {
        // Search → results → product page, etc.
        val emitted = flush(nowMs)
        openNew(nowMs, cleaned, fp, appPackage, appLabel, title, url, ocrConfidence)
        return emitted
      }
    }
  }

  /** Flush open buffer if it has been idle long enough (captures final screen). */
  fun flushIfIdle(nowMs: Long = System.currentTimeMillis()): DerivedRecallEvent? {
    val current = open ?: return null
    if (nowMs - current.updatedAtMs < idleFlushMs) return null
    return flush(nowMs)
  }

  fun flush(nowMs: Long = System.currentTimeMillis()): DerivedRecallEvent? {
    val current = open ?: return null
    open = null
    if (!TextSemantics.isMeaningful(current.text)) {
      RecallDiagnostics.eventsDropped += 1
      return null
    }
    RecallDiagnostics.eventsCreated += 1
    RecallDiagnostics.lastEventAt = nowMs
    return DerivedRecallEvent(
      clientEventId = "evt_${java.util.UUID.randomUUID().toString().replace("-", "").take(16)}",
      capturedAt = java.time.Instant.ofEpochMilli(current.updatedAtMs).toString(),
      sessionId = current.sessionId,
      extractedText = current.text.take(32_000),
      fingerprint = current.fingerprint,
      appPackage = current.appPackage,
      appLabel = current.appLabel,
      url = current.url,
      title = current.title ?: TextSemantics.inferContentTitle(current.text),
      ocrConfidence = current.ocrConfidence,
      pipelineVersion = "1.0.0",
      clientProcessingVersion = "1.1.0",
    )
  }

  private fun openNew(
    nowMs: Long,
    text: String,
    fp: String,
    appPackage: String?,
    appLabel: String?,
    title: String?,
    url: String?,
    ocrConfidence: Double?,
  ) {
    open = Buffer(
      sessionId = "ses_${java.util.UUID.randomUUID().toString().replace("-", "").take(12)}",
      appPackage = appPackage,
      appLabel = appLabel,
      text = text.take(maxBufferedChars),
      fingerprint = fp,
      title = title ?: TextSemantics.inferContentTitle(text),
      url = url,
      ocrConfidence = ocrConfidence,
      startedAtMs = nowMs,
      updatedAtMs = nowMs,
      snapshotCount = 1,
    )
  }

  private fun averageConfidence(previous: Double?, incoming: Double): Double {
    return if (previous == null) incoming else (previous + incoming) / 2.0
  }
}
