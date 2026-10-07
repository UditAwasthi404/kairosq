package expo.modules.kairosos

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

object KairosWidgetLinks {
  fun open(context: Context, widgetId: Int, slot: Int, uri: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      context,
      widgetId * 16 + slot,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
