package com.safedmmobile.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.safedmmobile.MainActivity
import com.safedmmobile.R

/**
 * Publication des notifications Android de SafeDM.
 *
 * Ce module ne decide rien : il affiche ce que le JS a decide. Aucune analyse,
 * aucun appel reseau, aucun contenu de message n'est ajoute au corps de la
 * notification par defaut — l'extrait-eventuel vient de `services/notifications.js`,
 * qui respecte le reglage « masquer le contenu des alertes ».
 *
 * Pourquoi un module natif plutot que `expo-notifications` : l'application
 * n'a besoin que de notifications locales, sans push, sans Firebase Messaging
 * et sans collecte de jeton d'appareil. Ajouter une dependance native pour cela
 * Augmenterait le risque de build sans ouvrir de functionality nouvelle.
 */
@ReactModule(name = SafeDMNotifierModule.NAME)
class SafeDMNotifierModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  init {
    Companion.reactContext = reactContext
  }

  override fun getName(): String = NAME

  private fun manager(): NotificationManager =
    reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  /**
   * Cree les canaux. Idempotent : Android ignore un canal deja cree, et
   * n'autorise plus a en changer l'importance apres coup.
   */
  @ReactMethod
  fun ensureChannels(promise: Promise) {
    try {
      CHANNELS.forEach { ensureChannel(it) }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CHANNELS_FAILED", e.message, e)
    }
  }

  /** L'utilisateur a-t-il autorise les notifications pour cette application ? */
  @ReactMethod
  fun areNotificationsEnabled(promise: Promise) {
    try {
      promise.resolve(manager().areNotificationsEnabled())
    } catch (e: Exception) {
      promise.reject("NOTIFICATIONS_STATUS_FAILED", e.message, e)
    }
  }

  /**
   * Publie une notification.
   *
   * @param payload `notificationId` (identifiant stable : republier la meme
   *   notification la remplace au lieu d'en empiler une nouvelle), `channel`
   *   (`alerts` | `info` | `quiet`), `title`, `body` et `data` (JSON
   *   serialise, redonne tel quel au JS quand l'utilisateur touche la
   *   notification).
   */
  @ReactMethod
  fun postNotification(payload: ReadableMap, promise: Promise) {
    try {
      val manager = manager()
      if (!manager.areNotificationsEnabled()) {
        promise.resolve(false)
        return
      }
      val channel = channelFor(payload.getString("channel"))
      ensureChannel(channel)
      val title = payload.getString("title") ?: "SafeDM"
      val body = payload.getString("body") ?: ""
      val data = if (payload.hasKey("data")) payload.getString("data") else null
      val notificationId = payload.getDouble("notificationId").toInt()

      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLinkFor(data)))
      intent.setClass(reactContext, MainActivity::class.java)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val pending = PendingIntent.getActivity(
        reactContext,
        notificationId,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(reactContext, channel.id)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(reactContext)
      }
      builder
        .setSmallIcon(R.mipmap.ic_launcher)
        .setColor(0xFF1F6BFF.toInt())
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(Notification.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setContentIntent(pending)
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        @Suppress("DEPRECATION")
        builder.setPriority(priorityFor(channel))
      }

      manager.notify(notificationId, builder.build())
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("POST_NOTIFICATION_FAILED", e.message, e)
    }
  }

  /** Retire toutes les notifications emises par SafeDM. */
  @ReactMethod
  fun cancelAll(promise: Promise) {
    try {
      manager().cancelAll()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CANCEL_ALL_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun addListener(eventName: String?) {
    // Requis par NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Requis par NativeEventEmitter
  }

  /**
   * Ouvre la page systeme des notifications de l'application.
   *
   * Repli sur la page generale de l'application : certains ROM OEM n'ont pas
   * la page dediee aux notifications.
   */
  @ReactMethod
  fun openNotificationSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      try {
        val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(Uri.fromParts("package", reactContext.packageName, null))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(fallback)
        promise.resolve(false)
      } catch (inner: Exception) {
        promise.reject("OPEN_NOTIFICATION_SETTINGS_FAILED", inner.message, inner)
      }
    }
  }

  /**
   * Payload de la notification qui a ouvert l'application, ou null.
   *
   * Consomme le payload : un second appel ne renvoie rien, pour ne pas
   * rejouer la navigation a chaque remontee de l'application.
   */
  @ReactMethod
  fun getLaunchPayload(promise: Promise) {
    try {
      val payload = synchronized(pendingLock) {
        val current = pendingPayload
        pendingPayload = null
        current
      }
      promise.resolve(payload)
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  private fun ensureChannel(spec: ChannelSpec) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = manager()
    if (manager.getNotificationChannel(spec.id) != null) return
    val channel = NotificationChannel(spec.id, reactContext.getString(spec.nameRes), spec.importance)
    channel.description = reactContext.getString(spec.descriptionRes)
    channel.setShowBadge(true)
    manager.createNotificationChannel(channel)
  }

  private fun channelFor(key: String?): ChannelSpec =
    CHANNELS.firstOrNull { it.key == key } ?: CHANNELS.first { it.key == "info" }

  private fun priorityFor(spec: ChannelSpec): Int =
    if (spec.importance >= NotificationManager.IMPORTANCE_HIGH) {
      Notification.PRIORITY_HIGH
    } else {
      Notification.PRIORITY_LOW
    }

  private fun deepLinkFor(data: String?): String {
    if (data.isNullOrBlank()) return DEEP_LINK
    return "$DEEP_LINK?payload=${Uri.encode(data)}"
  }

  companion object {
    const val NAME = "SafeDMNotifier"
    const val EVENT = "SafeDMNotificationTap"
    private const val DEEP_LINK = "safedm://notification"

    @Volatile
    var reactContext: ReactApplicationContext? = null

    private val pendingLock = Any()
    private var pendingPayload: String? = null

    /** Canaux : `key` est le nom logique utilise par le JS. */
    private class ChannelSpec(
      val key: String,
      val id: String,
      val nameRes: Int,
      val descriptionRes: Int,
      val importance: Int,
    )

    private val CHANNELS = listOf(
      ChannelSpec(
        key = "alerts",
        id = "safedm_alerts",
        nameRes = R.string.safedm_channel_alerts,
        descriptionRes = R.string.safedm_channel_alerts_description,
        importance = NotificationManager.IMPORTANCE_HIGH,
      ),
      ChannelSpec(
        key = "info",
        id = "safedm_info",
        nameRes = R.string.safedm_channel_info,
        descriptionRes = R.string.safedm_channel_info_description,
        importance = NotificationManager.IMPORTANCE_LOW,
      ),
      ChannelSpec(
        key = "quiet",
        id = "safedm_quiet",
        nameRes = R.string.safedm_channel_quiet,
        descriptionRes = R.string.safedm_channel_quiet_description,
        importance = NotificationManager.IMPORTANCE_LOW,
      ),
    )

    /**
     * Memorise le payload d'un demarrage a froid (l'application n'etait pas
     * lancee quand l'utilisateur a touche la notification).
     */
    fun captureLaunchIntent(intent: Intent?) {
      val payload = payloadFromIntent(intent) ?: return
      synchronized(pendingLock) { pendingPayload = payload }
    }

    /**
     * Notifie le JS que l'utilisateur a touche une notification.
     *
     * Si le bundle n'est pas encore pret, le payload est mis en attente et
     * `getLaunchPayload()` le remettra au premier appel.
     */
    fun onNewIntent(intent: Intent?) {
      val payload = payloadFromIntent(intent) ?: return
      val ctx = reactContext
      if (ctx == null || !ctx.hasActiveReactInstance()) {
        synchronized(pendingLock) { pendingPayload = payload }
        return
      }
      val map = Arguments.createMap()
      map.putString("payload", payload)
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT, map)
    }

    /** Extrait le JSON de la notification d'un intent. */
    fun payloadFromIntent(intent: Intent?): String? {
      val data = intent?.data ?: return null
      if (!data.toString().startsWith(DEEP_LINK)) return null
      return data.getQueryParameter("payload")
    }
  }
}
