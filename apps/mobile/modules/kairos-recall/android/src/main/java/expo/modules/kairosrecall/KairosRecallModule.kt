package expo.modules.kairosrecall

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.suspendCancellableCoroutine

class RecallConfigRecord : Record {
  @Field
  var apiBaseUrl: String? = null

  @Field
  var sampleIntervalMs: Double? = null

  @Field
  var maxOcrPerMinute: Double? = null

  @Field
  var denylistPackages: List<String>? = null

  @Field
  var entitlementAllowed: Boolean? = null
}

class KairosRecallModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val outbox by lazy { EncryptedOutbox(context) }
  private val uploader by lazy { RecallUploader(context) }

  override fun definition() = ModuleDefinition {
    Name("KairosRecall")

    AsyncFunction("prepare") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
        throw Exceptions.IllegalArgument("Recall requires Android 5+")
      }
      RecallRuntime.state = if (RecallRuntime.mediaProjectionData != null) "ready" else "idle"
      statusInternal()
    }

    AsyncFunction("requestConsent") Coroutine { ->
      val activity = appContext.currentActivity
        ?: throw Exceptions.MissingActivity()

      // Clear stale consent so the system dialog is shown again.
      RecallRuntime.clearConsent()
      RecallRuntime.state = "requesting_consent"

      suspendCancellableCoroutine { cont ->
        RecallRuntime.consentContinuation = cont
        cont.invokeOnCancellation {
          if (RecallRuntime.consentContinuation === cont) {
            RecallRuntime.consentContinuation = null
          }
        }
        // Start from the visible Activity (not application context) so the
        // MediaProjection system dialog is actually shown.
        activity.startActivity(RecallConsentActivity.createIntent(activity))
      }
    }

    AsyncFunction("hasNotificationPermission") {
      hasNotificationPermission()
    }

    AsyncFunction("start") {
      if (RecallRuntime.mediaProjectionData == null ||
        RecallRuntime.mediaProjectionResultCode != Activity.RESULT_OK
      ) {
        throw Exceptions.IllegalArgument("Call requestConsent() before start()")
      }
      if (!uploader.entitlementAllowedCached) {
        throw Exceptions.IllegalArgument("Recall entitlement is not active")
      }
      if (uploader.authToken.isNullOrBlank()) {
        throw Exceptions.IllegalArgument("Auth token is required before start()")
      }
      if (uploader.apiBaseUrl.isBlank()) {
        throw Exceptions.IllegalArgument("API base URL is required before start()")
      }
      if (!hasNotificationPermission()) {
        throw Exceptions.IllegalArgument(
          "Notification permission is required for Recall capture",
        )
      }
      RecallRuntime.paused = false
      uploader.userEnabled = true
      RecallCaptureService.start(context)
      statusInternal()
    }

    AsyncFunction("pause") {
      RecallCaptureService.send(context, RecallCaptureService.ACTION_PAUSE)
      // Reflect paused immediately even before service processes the intent.
      RecallRuntime.paused = true
      RecallRuntime.capturing = false
      RecallRuntime.state = "paused"
      statusInternal()
    }

    AsyncFunction("resume") Coroutine { ->
      // True pause/resume: projection still held by the service.
      if (RecallRuntime.state == "paused" && RecallRuntime.mediaProjectionData != null) {
        RecallCaptureService.send(context, RecallCaptureService.ACTION_RESUME)
        statusInternal()
      } else {
        // After Stop / process death / revoked consent, token is gone —
        // re-run consent then start instead of throwing.
        val activity = appContext.currentActivity
          ?: throw Exceptions.MissingActivity()
        if (!uploader.entitlementAllowedCached) {
          throw Exceptions.IllegalArgument("Recall entitlement is not active")
        }
        if (uploader.authToken.isNullOrBlank() || uploader.apiBaseUrl.isBlank()) {
          throw Exceptions.IllegalArgument("Auth token and API base URL are required")
        }
        if (!hasNotificationPermission()) {
          throw Exceptions.IllegalArgument(
            "Notification permission is required for Recall capture",
          )
        }

        RecallRuntime.clearConsent()
        RecallRuntime.state = "requesting_consent"
        val consent = suspendCancellableCoroutine { cont ->
          RecallRuntime.consentContinuation = cont
          cont.invokeOnCancellation {
            if (RecallRuntime.consentContinuation === cont) {
              RecallRuntime.consentContinuation = null
            }
          }
          activity.startActivity(RecallConsentActivity.createIntent(activity))
        }
        val granted = consent["granted"] == true
        if (!granted) {
          throw Exceptions.IllegalArgument("Screen capture permission was denied.")
        }
        RecallRuntime.paused = false
        RecallCaptureService.start(context)
        statusInternal()
      }
    }

    AsyncFunction("stop") {
      uploader.userEnabled = false
      RecallCaptureService.send(context, RecallCaptureService.ACTION_STOP)
      RecallRuntime.state = "idle"
      RecallRuntime.capturing = false
      RecallRuntime.paused = false
      statusInternal()
    }

    AsyncFunction("getStatus") {
      statusInternal()
    }

    AsyncFunction("flushUploads") {
      if (RecallRuntime.uploading) {
        return@AsyncFunction statusInternal()
      }
      RecallRuntime.uploading = true
      try {
        var rounds = 0
        while (rounds < 8) {
          rounds += 1
          val batch = outbox.peekBatch(20)
          if (batch.isEmpty()) break
          val outcome = uploader.uploadBatch(batch)
          if (!outcome.ok) {
            RecallRuntime.lastError = outcome.error
            break
          }
          outbox.acknowledge(outcome.acknowledgedIds)
          RecallRuntime.lastUploadBatchSize = outcome.acknowledgedIds.size
          RecallRuntime.lastError = null
          if (outcome.acknowledgedIds.isEmpty()) break
        }
      } finally {
        RecallRuntime.uploading = false
      }
      // Also nudge the capture service loop if it's running.
      try {
        RecallCaptureService.send(context, RecallCaptureService.ACTION_UPLOAD)
      } catch (_: Exception) {
        // Service may not be running when capture is off.
      }
      statusInternal()
    }

    AsyncFunction("setAuthToken") { token: String? ->
      // Never stop capture when the token is briefly missing during refresh.
      // Sign-out / data-delete paths call stop() explicitly.
      if (!token.isNullOrBlank()) {
        uploader.authToken = token
      }
      null
    }

    AsyncFunction("clearLocalData") {
      uploader.userEnabled = false
      RecallCaptureService.send(context, RecallCaptureService.ACTION_STOP)
      outbox.clear()
      uploader.clearAuthAndErrors()
      RecallRuntime.clearConsent()
      RecallRuntime.lastError = null
      statusInternal()
    }

    AsyncFunction("setConfig") { config: RecallConfigRecord ->
      config.apiBaseUrl?.let { uploader.apiBaseUrl = it }
      config.sampleIntervalMs?.let {
        RecallRuntime.sampleIntervalMs = it.toLong().coerceIn(400L, 5000L)
      }
      config.maxOcrPerMinute?.let {
        RecallRuntime.maxOcrPerMinute = it.toInt().coerceIn(1, 30)
      }
      config.denylistPackages?.let {
        RecallRuntime.denylistPackages = RecallRuntime.denylistPackages + it.toSet()
      }
      config.entitlementAllowed?.let {
        uploader.entitlementAllowedCached = it
      }
      statusInternal()
    }
  }

  private fun hasNotificationPermission(): Boolean {
    if (Build.VERSION.SDK_INT < 33) return true
    return ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.POST_NOTIFICATIONS,
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun statusInternal(): Map<String, Any?> {
    return RecallRuntime.statusMap(
      queuedCount = outbox.queuedCount(),
      lastUploadAt = uploader.lastUploadAt.takeIf { it > 0L },
      entitlementCached = uploader.entitlementAllowedCached,
      userEnabled = uploader.userEnabled,
    ).toMutableMap().also { map ->
      map["lastError"] = RecallRuntime.lastError ?: uploader.lastError
      map["notificationPermission"] = hasNotificationPermission()
      map["diagnostics"] = RecallDiagnostics.snapshot()
    }
  }
}
