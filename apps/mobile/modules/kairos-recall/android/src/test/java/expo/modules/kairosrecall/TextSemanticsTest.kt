package expo.modules.kairosrecall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TextSemanticsTest {
  private val amazonSearch =
    "Amazon\nSearch Amazon\nwireless earbuds\nSubmit search"

  private val amazonResults =
    "Amazon\nResults for wireless earbuds\nboAt Airdopes 141\n₹1,299\nNoise Buds VS104\n₹1,499\n4.3 stars"

  private val productTop =
    "Amazon\nboAt Nirvana Ion\nWireless Earbuds with ANC\n₹1,299\n4.4 stars\nAdd to Cart"

  private val productScroll =
    "boAt Nirvana Ion\nActive Noise Cancellation\nUp to 40 hours playback\nIPX5 water resistant"

  @Test
  fun searchQueryChangeIsMaterial() {
    val q1 = "Amazon\nSearch\nwireless earbuds\nRecent searches"
    val q2 = "Amazon\nSearch\nbluetooth headphones\nRecent searches"
    assertEquals(TextSemantics.Relation.MATERIAL, TextSemantics.relation(q1, q2))
  }

  @Test
  fun productPageIsMaterialAgainstResults() {
    assertEquals(
      TextSemantics.Relation.MATERIAL,
      TextSemantics.relation(amazonResults, productTop),
    )
  }

  @Test
  fun productScrollIsRelatedNotMaterialFlood() {
    assertEquals(
      TextSemantics.Relation.RELATED_SCROLL,
      TextSemantics.relation(productTop, productScroll),
    )
  }

  @Test
  fun chromeOnlyIsNotMeaningful() {
    assertEquals(false, TextSemantics.isMeaningful("Amazon"))
    assertEquals(true, TextSemantics.isMeaningful(productTop))
  }

  @Test
  fun inferTitleSkipsAmazonChrome() {
    val title = TextSemantics.inferContentTitle(productTop)
    assertTrue(title != null && title.contains("boAt"))
  }

  @Test
  fun unionPreservesPricesAndFeatures() {
    val merged = TextSemantics.unionLines(productTop, productScroll, 32_000)
    assertTrue(merged.contains("₹1,299") || merged.contains("1,299"))
    assertTrue(merged.contains("Active Noise Cancellation"))
  }

  @Test
  fun identicalScreensAreDuplicate() {
    assertEquals(
      TextSemantics.Relation.DUPLICATE,
      TextSemantics.relation(productTop, productTop),
    )
  }

  @Test
  fun searchSurvivesVsHomeChrome() {
    assertEquals(
      TextSemantics.Relation.MATERIAL,
      TextSemantics.relation(amazonSearch, amazonResults),
    )
  }
}
