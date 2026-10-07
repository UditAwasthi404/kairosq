package expo.modules.kairosrecall

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle

/**
 * Hosts the system MediaProjection consent dialog.
 * Avoids relying on ReactActivity activity-result forwarding.
 */
class RecallConsentActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val mgr = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    @Suppress("DEPRECATION")
    startActivityForResult(mgr.createScreenCaptureIntent(), REQUEST_CODE)
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) {
      super.onActivityResult(requestCode, resultCode, data)
      return
    }

    if (resultCode == RESULT_OK && data != null) {
      RecallRuntime.mediaProjectionResultCode = resultCode
      RecallRuntime.mediaProjectionData = data
      RecallRuntime.permission = "granted"
      RecallRuntime.state = "ready"
      RecallRuntime.completeConsent(
        mapOf(
          "granted" to true,
          "permission" to "granted",
        ),
      )
    } else {
      RecallRuntime.clearConsent()
      RecallRuntime.permission = "denied"
      RecallRuntime.state = "idle"
      RecallRuntime.completeConsent(
        mapOf(
          "granted" to false,
          "permission" to "denied",
        ),
      )
    }
    finish()
  }

  companion object {
    private const val REQUEST_CODE = 0x4B02

    fun createIntent(context: Context): Intent {
      return Intent(context, RecallConsentActivity::class.java)
    }
  }
}
