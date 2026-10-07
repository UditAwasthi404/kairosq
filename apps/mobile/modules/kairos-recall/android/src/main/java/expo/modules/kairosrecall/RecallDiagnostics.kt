package expo.modules.kairosrecall

/**
 * Development diagnostics for the capture pipeline.
 * Never stores raw OCR text.
 */
object RecallDiagnostics {
  @Volatile var framesSampled: Long = 0
  @Volatile var framesChanged: Long = 0
  @Volatile var ocrRuns: Long = 0
  @Volatile var ocrNonEmpty: Long = 0
  @Volatile var ocrTextCharsTotal: Long = 0
  @Volatile var maxOcrTextLength: Int = 0
  @Volatile var ocrConfidenceSum: Double = 0.0
  @Volatile var ocrConfidenceSamples: Long = 0
  @Volatile var eventsCreated: Long = 0
  @Volatile var eventsCoalesced: Long = 0
  @Volatile var eventsDropped: Long = 0
  @Volatile var lastOcrAt: Long = 0
  @Volatile var lastEventAt: Long = 0
  @Volatile var lastOcrTextLength: Int = 0
  @Volatile var lastRelation: String = ""

  fun reset() {
    framesSampled = 0
    framesChanged = 0
    ocrRuns = 0
    ocrNonEmpty = 0
    ocrTextCharsTotal = 0
    maxOcrTextLength = 0
    ocrConfidenceSum = 0.0
    ocrConfidenceSamples = 0
    eventsCreated = 0
    eventsCoalesced = 0
    eventsDropped = 0
    lastOcrAt = 0
    lastEventAt = 0
    lastOcrTextLength = 0
    lastRelation = ""
  }

  fun recordOcrResult(textLength: Int, confidence: Double?) {
    lastOcrAt = System.currentTimeMillis()
    lastOcrTextLength = textLength
    if (textLength > 0) {
      ocrNonEmpty += 1
      ocrTextCharsTotal += textLength.toLong()
      if (textLength > maxOcrTextLength) maxOcrTextLength = textLength
    }
    if (confidence != null && confidence > 0.0) {
      ocrConfidenceSum += confidence
      ocrConfidenceSamples += 1
    }
  }

  fun snapshot(): Map<String, Any?> {
    val avgLen =
      if (ocrNonEmpty == 0L) 0L else ocrTextCharsTotal / ocrNonEmpty
    val avgConf =
      if (ocrConfidenceSamples == 0L) null
      else ocrConfidenceSum / ocrConfidenceSamples
    return mapOf(
      "framesSampled" to framesSampled,
      "framesChanged" to framesChanged,
      "ocrRuns" to ocrRuns,
      "ocrNonEmpty" to ocrNonEmpty,
      "averageOcrTextLength" to avgLen,
      "maxOcrTextLength" to maxOcrTextLength,
      "averageOcrConfidence" to avgConf,
      "eventsCreated" to eventsCreated,
      "eventsCoalesced" to eventsCoalesced,
      "eventsDropped" to eventsDropped,
      "lastOcrAt" to lastOcrAt.takeIf { it > 0L },
      "lastEventAt" to lastEventAt.takeIf { it > 0L },
      "lastOcrTextLength" to lastOcrTextLength,
      "lastRelation" to lastRelation,
    )
  }
}
