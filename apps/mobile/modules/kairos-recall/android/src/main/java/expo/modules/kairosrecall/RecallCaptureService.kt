package expo.modules.kairosrecall

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

class RecallCaptureService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private var projection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private var handlerThread: HandlerThread? = null
  private var handler: Handler? = null
  private var sampleRunnable: Runnable? = null
  private val intentionalTeardown = AtomicBoolean(false)

  private lateinit var outbox: EncryptedOutbox
  private lateinit var uploader: RecallUploader
  private val aggregator = EventAggregator()
  private val ocr = OnDeviceOcr()

  private var previousSignature: LongArray? = null
  private val ocrTimestamps = ArrayDeque<Long>()
  private var backoffMs = RecallUploader.INITIAL_BACKOFF_MS
  private val processing = AtomicBoolean(false)
  private var currentSampleIntervalMs: Long = 800L
  private var lastStrongChangeAt: Long = 0L
  private var idleFlushRunnable: Runnable? = null
  private var uploadLoopStarted = false

  override fun onCreate() {
    super.onCreate()
    outbox = EncryptedOutbox(this)
    uploader = RecallUploader(this)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        // Explicit user off — invalidate MediaProjection.
        uploader.userEnabled = false
        stopCaptureInternal(clearConsent = true)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_PAUSE -> {
        // Keep MediaProjection + VirtualDisplay alive; only stop sampling.
        RecallRuntime.paused = true
        RecallRuntime.state = "paused"
        RecallRuntime.capturing = false
        stopSampling()
        flushAggregator()
        return START_STICKY
      }
      ACTION_RESUME -> {
        if (projection == null && RecallRuntime.mediaProjectionData == null) {
          RecallRuntime.lastError = "Screen capture consent required"
          RecallRuntime.state = "needs_consent"
          // Do not kill the desire to run — UI should prompt Turn on again.
          stopSelf()
          return START_NOT_STICKY
        }
        RecallRuntime.paused = false
        uploader.userEnabled = true
        startForegroundWithNotification()
        ensureProjectionAndSampling()
        return START_STICKY
      }
      ACTION_UPLOAD -> {
        scope.launch { flushUploads() }
        return START_STICKY
      }
      else -> {
        uploader.userEnabled = true
        startForegroundWithNotification()
        ensureProjectionAndSampling()
        scheduleUploadLoop()
        return START_STICKY
      }
    }
  }

  private fun startForegroundWithNotification() {
    val channelId = "kairos_recall"
    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      nm.createNotificationChannel(
        NotificationChannel(channelId, "Kairos Recall", NotificationManager.IMPORTANCE_LOW),
      )
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pi = PendingIntent.getActivity(
      this,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification: Notification = NotificationCompat.Builder(this, channelId)
      .setContentTitle("Kairos Recall is on")
      .setContentText("Reading screen text in the background. Turn off in Kairos → Recall.")
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setContentIntent(pi)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun ensureProjectionAndSampling() {
    if (RecallRuntime.paused) return
    val data = RecallRuntime.mediaProjectionData
    val code = RecallRuntime.mediaProjectionResultCode
    if (data == null || code != Activity.RESULT_OK) {
      RecallRuntime.lastError = "MediaProjection permission not granted"
      RecallRuntime.permission = "denied"
      stopSelf()
      return
    }

    if (projection == null) {
      val mgr = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      val mp = mgr.getMediaProjection(code, data.clone() as Intent)
        ?: run {
          // Token already consumed or revoked — force a fresh consent flow.
          RecallRuntime.lastError = "Screen capture consent expired. Enable Recall again."
          RecallRuntime.clearConsent()
          RecallRuntime.state = "stopped"
          stopSelf()
          return
        }
      mp.registerCallback(object : MediaProjection.Callback() {
        override fun onStop() {
          if (intentionalTeardown.get()) return
          // System/user revoked casting — cannot continue without a new consent.
          RecallRuntime.permission = "revoked"
          RecallRuntime.lastError =
            "Screen capture was revoked. Turn Recall on again to continue."
          RecallRuntime.capturing = false
          RecallRuntime.paused = false
          RecallRuntime.state = "needs_consent"
          // Keep userEnabled=true so the app knows the user still wants Recall.
          stopSampling()
          virtualDisplay?.release()
          virtualDisplay = null
          imageReader?.close()
          imageReader = null
          projection = null
          RecallRuntime.clearConsent()
          try {
            stopForeground(STOP_FOREGROUND_REMOVE)
          } catch (_: Exception) {
          }
          stopSelf()
        }
      }, Handler(Looper.getMainLooper()))
      projection = mp
    }

    if (imageReader == null) {
      val metrics = displayMetrics()
      // Prefer OCR-readable resolution (short side ~1080), not half-res.
      val srcW = metrics.widthPixels.coerceAtLeast(1)
      val srcH = metrics.heightPixels.coerceAtLeast(1)
      val targetShort = 1080
      val shortSide = minOf(srcW, srcH).toFloat()
      val scale = (targetShort / shortSide).coerceIn(0.6f, 1.0f)
      val width = (srcW * scale).toInt().coerceAtLeast(540)
      val height = (srcH * scale).toInt().coerceAtLeast(960)
      val density = metrics.densityDpi
      imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
      virtualDisplay = projection?.createVirtualDisplay(
        "kairos-recall",
        width,
        height,
        density,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
        imageReader?.surface,
        null,
        null,
      )
    }

    RecallRuntime.permission = "granted"
    RecallRuntime.capturing = true
    RecallRuntime.state = "capturing"
    startSampling()
  }

  private fun startSampling() {
    if (handlerThread == null) {
      handlerThread = HandlerThread("kairos-recall-capture").also { it.start() }
      handler = Handler(handlerThread!!.looper)
    }
    stopSampling()
    currentSampleIntervalMs = RecallRuntime.sampleIntervalMs.coerceIn(400L, 2500L)
    val runnable = object : Runnable {
      override fun run() {
        if (!RecallRuntime.paused && RecallRuntime.capturing) {
          captureOnce()
          // Idle flush so the last meaningful screen is not stuck forever.
          aggregator.flushIfIdle()?.let { outbox.enqueue(it) }
        }
        handler?.postDelayed(this, currentSampleIntervalMs)
      }
    }
    sampleRunnable = runnable
    handler?.post(runnable)
  }

  private fun stopSampling() {
    sampleRunnable?.let { handler?.removeCallbacks(it) }
    sampleRunnable = null
    idleFlushRunnable?.let { handler?.removeCallbacks(it) }
    idleFlushRunnable = null
  }

  private fun captureOnce() {
    if (!processing.compareAndSet(false, true)) return
    scope.launch {
      try {
        val reader = imageReader ?: return@launch
        val image = reader.acquireLatestImage() ?: return@launch
        val bitmap = imageToBitmap(image)
        image.close()
        if (bitmap == null) return@launch

        try {
          RecallDiagnostics.framesSampled += 1
          val signature = FrameDiffer.signature(bitmap)
          val diff = FrameDiffer.diff(previousSignature, signature)
          previousSignature = signature
          currentSampleIntervalMs =
            FrameDiffer.nextSampleIntervalMs(diff, RecallRuntime.sampleIntervalMs)

          if (!diff.changed) return@launch
          RecallDiagnostics.framesChanged += 1
          if (diff.strongChange) {
            lastStrongChangeAt = System.currentTimeMillis()
          }

          if (!canOcrNow(diff)) return@launch
          recordOcr()

          val pkg = foregroundPackageGuess()
          if (pkg != null && RecallRuntime.denylistPackages.contains(pkg)) {
            RecallDiagnostics.eventsDropped += 1
            return@launch
          }

          val ocrResult = ocr.extract(bitmap)
          RecallDiagnostics.ocrRuns += 1
          RecallDiagnostics.recordOcrResult(ocrResult.text.length, ocrResult.confidence)

          if (!TextSemantics.isMeaningful(ocrResult.text)) {
            RecallDiagnostics.eventsDropped += 1
            return@launch
          }

          val event = aggregator.ingest(
            nowMs = System.currentTimeMillis(),
            text = ocrResult.text,
            appPackage = pkg,
            appLabel = null,
            title = TextSemantics.inferContentTitle(ocrResult.text),
            url = extractUrl(ocrResult.text),
            ocrConfidence = ocrResult.confidence,
          )
          if (event != null) {
            outbox.enqueue(event)
          }
        } finally {
          bitmap.recycle()
        }
      } catch (e: Exception) {
        RecallRuntime.lastError = e.message
      } finally {
        processing.set(false)
      }
    }
  }

  /**
   * Adaptive OCR budget:
   * - calm/static: configured maxOcrPerMinute
   * - recent strong visual change: up to ~2.5× (capped at 30)
   * Strong changes get priority even near the calm budget.
   */
  private fun canOcrNow(diff: FrameDiffer.DiffResult): Boolean {
    val now = System.currentTimeMillis()
    while (ocrTimestamps.isNotEmpty() && now - ocrTimestamps.first() > 60_000L) {
      ocrTimestamps.removeFirst()
    }
    val active =
      diff.strongChange || now - lastStrongChangeAt < 25_000L
    val calm = RecallRuntime.maxOcrPerMinute.coerceIn(1, 30)
    val budget = if (active) {
      (calm * 5 / 2).coerceIn(calm, 30)
    } else {
      calm
    }
    if (ocrTimestamps.size < budget) return true
    // Still allow an immediate OCR on strong change by dropping oldest slot.
    if (diff.strongChange && ocrTimestamps.isNotEmpty()) {
      ocrTimestamps.removeFirst()
      return true
    }
    return false
  }

  private fun recordOcr() {
    ocrTimestamps.addLast(System.currentTimeMillis())
  }

  private fun flushAggregator() {
    aggregator.flush()?.let { outbox.enqueue(it) }
  }

  private fun scheduleUploadLoop() {
    if (uploadLoopStarted) return
    uploadLoopStarted = true
    if (handlerThread == null) {
      handlerThread = HandlerThread("kairos-recall-capture").also { it.start() }
      handler = Handler(handlerThread!!.looper)
    }
    handler?.postDelayed(object : Runnable {
      override fun run() {
        scope.launch {
          flushUploads()
        }
        val queued = try {
          outbox.queuedCount()
        } catch (_: Exception) {
          0
        }
        val delay = when {
          uploader.lastError != null -> backoffMs
          queued > 0 || RecallRuntime.uploading -> 3_500L
          else -> 20_000L
        }
        handler?.postDelayed(this, delay)
      }
    }, 2_500L)
  }

  private suspend fun flushUploads() {
    if (RecallRuntime.uploading) return
    RecallRuntime.uploading = true
    try {
      var rounds = 0
      while (rounds < 8) {
        rounds += 1
        val batch = outbox.peekBatch(20)
        if (batch.isEmpty()) {
          RecallRuntime.lastError = null
          break
        }
        val outcome = uploader.uploadBatch(batch)
        if (outcome.ok) {
          outbox.acknowledge(outcome.acknowledgedIds)
          RecallRuntime.lastUploadBatchSize = outcome.acknowledgedIds.size
          backoffMs = RecallUploader.INITIAL_BACKOFF_MS
          RecallRuntime.lastError = null
          // Nothing drained — avoid spinning on a stuck batch.
          if (outcome.acknowledgedIds.isEmpty()) break
        } else {
          RecallRuntime.lastError = outcome.error
          backoffMs = (backoffMs * 2).coerceAtMost(RecallUploader.MAX_BACKOFF_MS)
          // Never stop capture on auth/network errors — keep reading screens and
          // retry uploads when a fresh token is available.
          if (outcome.entitlementRequired) {
            outbox.clear()
            uploader.userEnabled = false
            stopCaptureInternal(clearConsent = true)
            stopSelf()
          }
          break
        }
      }
    } finally {
      RecallRuntime.uploading = false
    }
  }

  private fun stopCaptureInternal(clearConsent: Boolean) {
    intentionalTeardown.set(true)
    try {
      flushAggregator()
      stopSampling()
      virtualDisplay?.release()
      virtualDisplay = null
      imageReader?.close()
      imageReader = null
      try {
        projection?.stop()
      } catch (_: Exception) {
      }
      projection = null
      RecallRuntime.capturing = false
      RecallRuntime.paused = false
      // After MediaProjection.stop(), the consent token cannot be reused.
      RecallRuntime.clearConsent()
      if (clearConsent) {
        uploader.userEnabled = false
        RecallRuntime.state = "idle"
      } else {
        RecallRuntime.state = "stopped"
      }
      try {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } catch (_: Exception) {
      }
    } finally {
      intentionalTeardown.set(false)
    }
  }

  override fun onDestroy() {
    // Process/service teardown. Do not clear userEnabled — user still wants Recall
    // after process death; they will need to turn on again for a new consent.
    intentionalTeardown.set(true)
    try {
      flushAggregator()
      stopSampling()
      virtualDisplay?.release()
      virtualDisplay = null
      imageReader?.close()
      imageReader = null
      try {
        projection?.stop()
      } catch (_: Exception) {
      }
      projection = null
      RecallRuntime.capturing = false
      RecallRuntime.paused = false
      RecallRuntime.clearConsent()
      if (uploader.userEnabled) {
        RecallRuntime.state = "needs_consent"
        RecallRuntime.lastError =
          "Recall stopped when the app process ended. Turn it on again."
      } else {
        RecallRuntime.state = "idle"
      }
    } finally {
      intentionalTeardown.set(false)
    }
    ocr.close()
    scope.cancel()
    handlerThread?.quitSafely()
    handlerThread = null
    uploadLoopStarted = false
    super.onDestroy()
  }

  private fun displayMetrics(): DisplayMetrics {
    val wm = getSystemService(WINDOW_SERVICE) as WindowManager
    val metrics = DisplayMetrics()
    @Suppress("DEPRECATION")
    wm.defaultDisplay.getRealMetrics(metrics)
    return metrics
  }

  private fun imageToBitmap(image: Image): Bitmap? {
    return try {
      val plane = image.planes[0]
      val buffer: ByteBuffer = plane.buffer
      val pixelStride = plane.pixelStride
      val rowStride = plane.rowStride
      val rowPadding = rowStride - pixelStride * image.width
      val bitmap = Bitmap.createBitmap(
        image.width + rowPadding / pixelStride,
        image.height,
        Bitmap.Config.ARGB_8888,
      )
      bitmap.copyPixelsFromBuffer(buffer)
      Bitmap.createBitmap(bitmap, 0, 0, image.width, image.height).also {
        if (it !== bitmap) bitmap.recycle()
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun foregroundPackageGuess(): String? {
    // Best-effort only. Never requires Usage Access — returns null if unavailable.
    return try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return null
      val usm =
        getSystemService(Context.USAGE_STATS_SERVICE) as? android.app.usage.UsageStatsManager
          ?: return null
      val end = System.currentTimeMillis()
      val stats = usm.queryUsageStats(
        android.app.usage.UsageStatsManager.INTERVAL_BEST,
        end - 60_000L,
        end,
      )
      if (stats.isNullOrEmpty()) return null
      stats.maxByOrNull { it.lastTimeUsed }?.packageName
        ?.takeIf { it.isNotBlank() && it != packageName }
    } catch (_: Exception) {
      null
    }
  }

  private fun extractUrl(text: String): String? {
    val match = Regex("https?://[^\\s]+").find(text) ?: return null
    return match.value.trimEnd('.', ',', ')', ']')
  }

  companion object {
    const val ACTION_STOP = "com.kairos.recall.STOP"
    const val ACTION_PAUSE = "com.kairos.recall.PAUSE"
    const val ACTION_RESUME = "com.kairos.recall.RESUME"
    const val ACTION_UPLOAD = "com.kairos.recall.UPLOAD"
    private const val NOTIFICATION_ID = 7341

    fun start(context: Context) {
      val intent = Intent(context, RecallCaptureService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun send(context: Context, action: String) {
      val intent = Intent(context, RecallCaptureService::class.java).setAction(action)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && action == ACTION_RESUME) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }
  }
}
