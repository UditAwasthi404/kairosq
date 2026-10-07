package expo.modules.kairosos

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Tray notification for share / keyboard uploads that happen outside JS.
 */
object KairosUploadNotifier {
  const val CHANNEL_ID = "kairos_updates"
  private const val NOTIFICATION_ID = 4201

  fun notifySubmit(context: Context, result: KairosCaptureStore.SubmitResult) {
    val title = when {
      result.ok -> "Saved to Kairos"
      result.queued -> "Saved on this device"
      else -> "Kairos could not save that"
    }
    val body = when {
      result.ok -> "Your capture is processing. You will get a notification when it is ready."
      result.queued -> "Kairos will upload this capture when you are back online."
      else -> result.error ?: "Try again from Kairos."
    }
    val uri =
      if (!result.observationId.isNullOrBlank()) {
        "kairos://observation/${result.observationId}"
      } else {
        "kairos://notifications"
      }
    show(context, title, body, uri)
  }

  fun show(context: Context, title: String, body: String, uri: String) {
    if (!canPost(context)) return
    ensureChannel(context)
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pending = PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_upload)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
  }

  private fun canPost(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < 33) return true
    return ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.POST_NOTIFICATIONS,
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "Kairos updates",
        NotificationManager.IMPORTANCE_DEFAULT,
      ),
    )
  }
}
