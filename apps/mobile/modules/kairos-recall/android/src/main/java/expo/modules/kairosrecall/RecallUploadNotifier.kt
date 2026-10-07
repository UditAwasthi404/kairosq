package expo.modules.kairosrecall

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
 * Throttled tray notice after a Recall batch reaches the server.
 * Separate from the ongoing "Recall is on" foreground notification.
 */
object RecallUploadNotifier {
  const val CHANNEL_ID = "kairos_updates"
  private const val NOTIFICATION_ID = 4202
  private const val PREFS = "kairos_recall_prefs"
  private const val LAST_NOTIFY_AT = "lastUploadNotifyAt"
  private const val THROTTLE_MS = 3 * 60_000L

  fun notifyBatch(context: Context, uploadedCount: Int) {
    if (uploadedCount <= 0) return
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val last = prefs.getLong(LAST_NOTIFY_AT, 0L)
    val now = System.currentTimeMillis()
    if (now - last < THROTTLE_MS) return
    prefs.edit().putLong(LAST_NOTIFY_AT, now).apply()

    val title = if (uploadedCount == 1) "Recall uploaded" else "Recall uploaded $uploadedCount memories"
    val body = "Screen text was saved to Kairos."
    show(context, title, body)
  }

  private fun show(context: Context, title: String, body: String) {
    if (!canPost(context)) return
    ensureChannel(context)
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("kairos://notifications")).apply {
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
