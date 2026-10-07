package expo.modules.kairosrecall

import android.content.Intent
import kotlinx.coroutines.CancellableContinuation
import kotlin.coroutines.resume

/**
 * Process-local consent + runtime state. Consent is never auto-restored after reboot.
 */
object RecallRuntime {
  @Volatile var state: String = "idle"
  @Volatile var permission: String = "unknown"
  @Volatile var capturing: Boolean = false
  @Volatile var paused: Boolean = false
  @Volatile var lastError: String? = null
  @Volatile var mediaProjectionResultCode: Int = 0
  @Volatile var mediaProjectionData: Intent? = null
  @Volatile var sampleIntervalMs: Long = 700L
  @Volatile var maxOcrPerMinute: Int = 12
  @Volatile var denylistPackages: Set<String> = defaultDenylist()
  /** True while an upload batch is in flight. */
  @Volatile var uploading: Boolean = false
  /** Events acknowledged in the most recent successful upload. */
  @Volatile var lastUploadBatchSize: Int = 0

  @Volatile
  var consentContinuation: CancellableContinuation<Map<String, Any?>>? = null

  fun completeConsent(result: Map<String, Any?>) {
    val cont = consentContinuation
    consentContinuation = null
    if (cont != null && cont.isActive) {
      cont.resume(result)
    }
  }

  fun clearConsent() {
    mediaProjectionResultCode = 0
    mediaProjectionData = null
    permission = "unknown"
    capturing = false
    paused = false
    state = "idle"
  }

  fun statusMap(
    queuedCount: Int,
    lastUploadAt: Long?,
    entitlementCached: Boolean?,
    userEnabled: Boolean = false,
  ): Map<String, Any?> {
    return mapOf(
      "state" to state,
      "permission" to permission,
      "capturing" to capturing,
      "paused" to paused,
      "on" to capturing,
      "userEnabled" to userEnabled,
      "queuedCount" to queuedCount,
      "lastError" to lastError,
      "lastUploadAt" to lastUploadAt,
      "uploading" to uploading,
      "lastUploadBatchSize" to lastUploadBatchSize,
      "entitlementCached" to entitlementCached,
      "platform" to "android",
    )
  }

  private fun defaultDenylist(): Set<String> = setOf(
    "com.google.android.apps.authenticator2",
    "com.azure.authenticator",
    "com.authy.authy",
    "com.onepassword.android",
    "com.bitwarden.app",
    "com.lastpass.lpandroid",
    "com.dashlane",
    "com.samsung.android.spay",
    "com.google.android.apps.walletnfcrel",
    "com.chase.sig.android",
    "com.wf.wellsfargomobile",
    "com.bankofamerica.plantools",
  )
}
