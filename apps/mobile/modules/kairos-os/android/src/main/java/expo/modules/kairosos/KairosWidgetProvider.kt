package expo.modules.kairosos

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

class KairosWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    updateAll(context, appWidgetManager, appWidgetIds, KairosCaptureStore(context).insightText)
  }

  companion object {
    fun updateAll(
      context: Context,
      manager: AppWidgetManager,
      ids: IntArray,
      insight: String,
    ) {
      for (id in ids) {
        val views = RemoteViews(context.packageName, R.layout.kairos_widget)
        views.setTextViewText(R.id.kairos_widget_insight, insight)
        views.setOnClickPendingIntent(
          R.id.kairos_widget_capture,
          KairosWidgetLinks.open(context, id, 1, "kairos://capture?source=WIDGET"),
        )
        views.setOnClickPendingIntent(
          R.id.kairos_widget_ask,
          KairosWidgetLinks.open(context, id, 2, "kairos://ask"),
        )
        views.setOnClickPendingIntent(
          R.id.kairos_widget_root,
          KairosWidgetLinks.open(context, id, 0, "kairos://insight"),
        )
        manager.updateAppWidget(id, views)
      }
    }
  }
}

class KairosCaptureWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    for (id in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.kairos_widget_capture)
      views.setOnClickPendingIntent(
        R.id.kairos_capture_main,
        KairosWidgetLinks.open(context, id, 1, "kairos://capture?source=WIDGET"),
      )
      views.setOnClickPendingIntent(
        R.id.kairos_capture_voice,
        KairosWidgetLinks.open(context, id, 2, "kairos://voice?source=WIDGET"),
      )
      views.setOnClickPendingIntent(
        R.id.kairos_capture_root,
        KairosWidgetLinks.open(context, id, 0, "kairos://capture?source=WIDGET"),
      )
      appWidgetManager.updateAppWidget(id, views)
    }
  }
}

class KairosAskWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    val insight = KairosCaptureStore(context).insightText
    for (id in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.kairos_widget_ask)
      views.setTextViewText(R.id.kairos_ask_insight, insight)
      val ask = KairosWidgetLinks.open(context, id, 1, "kairos://ask")
      views.setOnClickPendingIntent(R.id.kairos_ask_button, ask)
      views.setOnClickPendingIntent(R.id.kairos_ask_root, ask)
      appWidgetManager.updateAppWidget(id, views)
    }
  }
}

class KairosActionsWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    for (id in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.kairos_widget_actions)
      views.setOnClickPendingIntent(
        R.id.kairos_action_capture,
        KairosWidgetLinks.open(context, id, 1, "kairos://capture?source=WIDGET"),
      )
      views.setOnClickPendingIntent(
        R.id.kairos_action_voice,
        KairosWidgetLinks.open(context, id, 2, "kairos://voice?source=WIDGET"),
      )
      views.setOnClickPendingIntent(
        R.id.kairos_action_ask,
        KairosWidgetLinks.open(context, id, 3, "kairos://ask"),
      )
      views.setOnClickPendingIntent(
        R.id.kairos_action_brief,
        KairosWidgetLinks.open(context, id, 4, "kairos://brief"),
      )
      appWidgetManager.updateAppWidget(id, views)
    }
  }
}

fun refreshKairosWidgets(context: Context, insight: String) {
  val manager = AppWidgetManager.getInstance(context)
  fun push(provider: Class<*>, update: (IntArray) -> Unit) {
    val ids = manager.getAppWidgetIds(android.content.ComponentName(context, provider))
    if (ids.isNotEmpty()) update(ids)
  }
  push(KairosWidgetProvider::class.java) {
    KairosWidgetProvider.updateAll(context, manager, it, insight)
  }
  push(KairosCaptureWidgetProvider::class.java) {
    KairosCaptureWidgetProvider().onUpdate(context, manager, it)
  }
  push(KairosAskWidgetProvider::class.java) {
    KairosAskWidgetProvider().onUpdate(context, manager, it)
  }
  push(KairosActionsWidgetProvider::class.java) {
    KairosActionsWidgetProvider().onUpdate(context, manager, it)
  }
}
