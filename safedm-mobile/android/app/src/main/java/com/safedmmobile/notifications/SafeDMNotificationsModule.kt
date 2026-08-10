package com.safedmmobile.notifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = SafeDMNotificationsModule.NAME)
class SafeDMNotificationsModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  init {
    Companion.reactContext = reactContext
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun isNotificationAccessEnabled(promise: Promise) {
    promise.resolve(hasNotificationAccess(reactContext))
  }

  @ReactMethod
  fun openNotificationListenerSettings() {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun setMonitoredPackages(packages: ReadableArray) {
    val prefs = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val set = linkedSetOf<String>()
    for (i in 0 until packages.size()) {
      packages.getString(i)?.let { set.add(it) }
    }
    prefs.edit().putStringSet(KEY_PACKAGES, set).apply()
  }

  @ReactMethod
  fun addListener(eventName: String?) {
    // Required for NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter
  }

  companion object {
    const val NAME = "SafeDMNotifications"
    const val PREFS = "safedm_nls"
    const val KEY_PACKAGES = "monitored_packages"
    const val EVENT = "SafeDMNotification"

    @Volatile
    var reactContext: ReactApplicationContext? = null

    fun hasNotificationAccess(context: Context): Boolean {
      val flat = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners",
      ) ?: return false
      val cn = ComponentName(context, SafeDMNotificationListenerService::class.java)
      val flattened = cn.flattenToString()
      val enabled = TextUtils.SimpleStringSplitter(':')
      enabled.setString(flat)
      while (enabled.hasNext()) {
        if (enabled.next().equals(flattened, ignoreCase = true)) {
          return true
        }
      }
      return false
    }

    fun monitoredPackages(context: Context): Set<String> {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      return prefs.getStringSet(KEY_PACKAGES, emptySet()) ?: emptySet()
    }

    fun emitNotification(payload: WritableMap) {
      val ctx = reactContext ?: return
      if (!ctx.hasActiveReactInstance()) return
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT, payload)
    }

    fun buildPayload(
      packageName: String,
      title: String?,
      text: String?,
      postTime: Long,
    ): WritableMap {
      val map = Arguments.createMap()
      map.putString("packageName", packageName)
      map.putString("title", title ?: "")
      map.putString("text", text ?: "")
      map.putDouble("postTime", postTime.toDouble())
      return map
    }
  }
}
