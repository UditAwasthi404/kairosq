package expo.modules.kairosrecall

/**
 * Text helpers for meaningfulness, similarity, and information-preserving merges.
 *
 * Relation scoring uses *content* tokens (chrome stripped) so shared app chrome
 * like "Amazon" / "Cart" does not collapse distinct screens into one event.
 */
object TextSemantics {
  private val TOKEN_RE = Regex("[\\p{L}\\p{N}]{2,}")
  private val PRICE_RE = Regex("(?:₹|rs\\.?|inr|\\$|€|£)\\s?[\\d,.]+|[\\d,.]+\\s?(?:rs\\.?|inr)", RegexOption.IGNORE_CASE)
  private val NOISE_LINES = setOf(
    "skip", "allow", "deny", "ok", "cancel", "done", "close", "back",
  )
  /** Shared navigation chrome that should not dominate similarity. */
  private val CHROME_TOKENS = setOf(
    "amazon", "flipkart", "chrome", "google", "youtube", "instagram", "whatsapp",
    "menu", "cart", "account", "home", "search", "shop", "buy", "now", "add",
    "deliver", "location", "orders", "prime", "wishlist", "filter", "sort",
    "results", "submit", "recent", "searches", "skip", "allow", "deny", "cancel",
    "close", "back", "next", "more", "less", "see", "all", "view", "open",
    "share", "save", "like", "follow", "settings", "notification", "notifications",
  )

  fun tokens(text: String): Set<String> {
    return TOKEN_RE.findAll(text.lowercase())
      .map { it.value }
      .filter { it !in NOISE_LINES }
      .toSet()
  }

  /** Tokens that carry screen meaning (titles, queries, prices, features). */
  fun contentTokens(text: String): Set<String> {
    return TOKEN_RE.findAll(text.lowercase())
      .map { it.value }
      .filter { it !in NOISE_LINES && it !in CHROME_TOKENS && it.length >= 2 }
      .toSet()
  }

  fun jaccard(a: Set<String>, b: Set<String>): Double {
    if (a.isEmpty() && b.isEmpty()) return 1.0
    if (a.isEmpty() || b.isEmpty()) return 0.0
    val inter = a.intersect(b).size.toDouble()
    val union = a.union(b).size.toDouble()
    return if (union == 0.0) 0.0 else inter / union
  }

  fun newTokenRatio(previous: Set<String>, incoming: Set<String>): Double {
    if (incoming.isEmpty()) return 0.0
    val novel = incoming.count { it !in previous }.toDouble()
    return novel / incoming.size
  }

  fun isMeaningful(text: String): Boolean {
    val cleaned = text.trim()
    if (cleaned.length < 20) return false
    val content = contentTokens(cleaned)
    val all = tokens(cleaned)
    val alphaNum = cleaned.count { it.isLetterOrDigit() }
    if (alphaNum < 16) return false
    // Distinctive query/product tokens OR enough general tokens.
    if (content.size >= 2) return true
    return all.size >= 4
  }

  /**
   * Keep unique lines in stable order; prefer longer lines when near-duplicates.
   */
  fun unionLines(existing: String, incoming: String, maxChars: Int): String {
    val lines = LinkedHashMap<String, String>()
    fun addBlock(block: String) {
      for (raw in block.split('\n')) {
        val line = raw.trim()
        if (line.length < 2) continue
        val key = FingerprintUtil.normalizeText(line)
        if (key.length < 2) continue
        val prev = lines[key]
        if (prev == null || line.length > prev.length) {
          lines[key] = line
        }
      }
    }
    addBlock(existing)
    addBlock(incoming)
    val merged = lines.values.joinToString("\n")
    return merged.take(maxChars)
  }

  /** First non-chrome content line — better event title than "Amazon". */
  fun inferContentTitle(text: String): String? {
    for (raw in text.lineSequence()) {
      val line = raw.trim()
      if (line.length !in 4..120) continue
      val lower = line.lowercase()
      val toks = contentTokens(line)
      if (toks.isEmpty()) continue
      if (CHROME_TOKENS.contains(lower) || lower in setOf("search amazon", "menu")) continue
      return line.take(100)
    }
    return text.lineSequence().map { it.trim() }.firstOrNull { it.length in 4..120 }?.take(80)
  }

  fun prices(text: String): Set<String> {
    return PRICE_RE.findAll(text.lowercase()).map { it.value.replace("\\s".toRegex(), "") }.toSet()
  }

  /**
   * Classify relationship between previous and incoming OCR.
   */
  enum class Relation {
    DUPLICATE,
    RELATED_SCROLL,
    MATERIAL,
  }

  fun relation(previousText: String, incomingText: String): Relation {
    val aAll = tokens(previousText)
    val bAll = tokens(incomingText)
    val a = contentTokens(previousText).ifEmpty { aAll }
    val b = contentTokens(incomingText).ifEmpty { bAll }
    val jac = jaccard(a, b)
    val novel = newTokenRatio(a, b)
    val onlyPrev = a.subtract(b)
    val onlyNext = b.subtract(a)
    val lenRatio =
      if (previousText.isEmpty()) 1.0
      else incomingText.length.toDouble() / previousText.length.coerceAtLeast(1)

    val prevTitle = inferContentTitle(previousText)?.lowercase()
    val nextTitle = inferContentTitle(incomingText)?.lowercase()
    val titleChanged =
      prevTitle != null &&
        nextTitle != null &&
        prevTitle != nextTitle &&
        jaccard(contentTokens(prevTitle), contentTokens(nextTitle)) < 0.5

    // Require near-identical titles so "wireless earbuds" vs
    // "Results for wireless earbuds" is not treated as the same page.
    val sameTitleFamily =
      prevTitle != null &&
        nextTitle != null &&
        jaccard(contentTokens(prevTitle), contentTokens(nextTitle)) >= 0.85

    val prevPrices = prices(previousText)
    val nextPrices = prices(incomingText)
    val priceChanged =
      prevPrices.isNotEmpty() &&
        nextPrices.isNotEmpty() &&
        prevPrices.intersect(nextPrices).isEmpty()

    // Heavy content replacement (search → results) even when query tokens overlap.
    val contentTurnover =
      onlyNext.size >= 4 && novel >= 0.55 && jac < 0.35

    return when {
      jac >= 0.90 && novel < 0.10 -> Relation.DUPLICATE
      // Distinct screen: title swap, price swap, or distinctive content turnover.
      titleChanged -> Relation.MATERIAL
      priceChanged && novel >= 0.15 -> Relation.MATERIAL
      // Same product/page title with newly revealed body (scroll / expand).
      // Must precede contentTurnover so feature-scroll isn't treated as a new page.
      sameTitleFamily && novel >= 0.12 -> Relation.RELATED_SCROLL
      contentTurnover -> Relation.MATERIAL
      onlyPrev.size >= 2 && onlyNext.size >= 2 && novel >= 0.20 -> Relation.MATERIAL
      // Same page with newly revealed lines (scroll / expand).
      jac >= 0.35 && novel >= 0.15 -> Relation.RELATED_SCROLL
      jac >= 0.50 && lenRatio in 0.65..1.5 && novel < 0.28 -> Relation.RELATED_SCROLL
      else -> Relation.MATERIAL
    }
  }
}
