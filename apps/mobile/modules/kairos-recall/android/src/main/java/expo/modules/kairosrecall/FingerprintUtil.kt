package expo.modules.kairosrecall

import java.security.MessageDigest

object FingerprintUtil {
  fun normalizeText(text: String): String {
    return text
      .lowercase()
      .replace(Regex("\\s+"), " ")
      .trim()
  }

  fun fingerprint(text: String, appPackage: String?): String {
    val payload = "${normalizeText(text)}|${appPackage.orEmpty()}"
    val digest = MessageDigest.getInstance("SHA-256").digest(payload.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { "%02x".format(it) }
  }
}
