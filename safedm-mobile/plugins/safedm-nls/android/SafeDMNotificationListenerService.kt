package com.safedmmobile.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Capture les notifications des packages surveillés (WhatsApp / SMS / Email).
 * Ne bloque ni ne modifie jamais les messages utilisateur.
 */
class SafeDMNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || sbn.isOngoing) return

    val packageName = sbn.packageName ?: return
    val stored = SafeDMNotificationsModule.monitoredPackages(applicationContext)
    val defaults = setOf(
      "com.whatsapp",
      "com.whatsapp.w4b",
      "com.google.android.apps.messaging",
      "com.android.mms",
      "com.samsung.android.messaging",
      "com.google.android.gm",
      "com.microsoft.office.outlook",
    )
    val allowed = if (stored.isEmpty()) defaults else stored
    if (packageName !in allowed) {
      return
    }

    if (packageName == applicationContext.packageName) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val text =
      extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()

    if (title.isNullOrBlank() && text.isNullOrBlank()) return

    val payload = SafeDMNotificationsModule.buildPayload(
      packageName = packageName,
      title = title,
      text = text,
      postTime = sbn.postTime,
    )
    SafeDMNotificationsModule.emitNotification(payload)
  }
}
