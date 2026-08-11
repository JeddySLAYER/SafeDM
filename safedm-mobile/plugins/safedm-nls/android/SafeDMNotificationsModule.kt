package com.safedmmobile.notifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.util.ArrayList
import java.util.Collections
import java.util.Locale

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
    prefs.edit()
      .putBoolean(KEY_CONFIGURED, true)
      .putStringSet(KEY_PACKAGES, set)
      .apply()
  }

  /**
   * Liste les applications installées visibles (lanceurs).
   * Chaque entrée inclut `icon` = chemin file:// vers le vrai logo Android (PNG en cache).
   */
  @ReactMethod
  fun listInstalledApps(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val intent = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolveInfos = pm.queryIntentActivities(intent, 0)
      val seen = HashSet<String>()
      val out: WritableArray = Arguments.createArray()
      val selfPkg = reactContext.packageName
      val iconDir = ensureIconCacheDir()

      for (info in resolveInfos) {
        val pkg = info.activityInfo?.packageName ?: continue
        if (pkg == selfPkg || !seen.add(pkg)) continue
        val label = try {
          info.loadLabel(pm)?.toString() ?: pkg
        } catch (_: Exception) {
          pkg
        }
        val drawable = try {
          info.loadIcon(pm) ?: pm.getApplicationIcon(pkg)
        } catch (_: Exception) {
          try {
            pm.getApplicationIcon(pkg)
          } catch (_: Exception) {
            null
          }
        }
        val iconPath = cacheAppIcon(iconDir, pkg, drawable)
        val row = Arguments.createMap()
        row.putString("name", label)
        row.putString("packageName", pkg)
        if (!iconPath.isNullOrBlank()) {
          row.putString("icon", iconPath)
        }
        out.pushMap(row)
      }
      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("LIST_APPS_FAILED", e.message, e)
    }
  }

  /** Renvoie le vrai logo d'un package (file://) ou null. */
  @ReactMethod
  fun getAppIcon(packageName: String, promise: Promise) {
    try {
      if (packageName.isBlank()) {
        promise.resolve(null)
        return
      }
      val pm = reactContext.packageManager
      val drawable = try {
        pm.getApplicationIcon(packageName)
      } catch (_: PackageManager.NameNotFoundException) {
        null
      }
      val path = cacheAppIcon(ensureIconCacheDir(), packageName, drawable)
      promise.resolve(path)
    } catch (e: Exception) {
      promise.reject("GET_APP_ICON_FAILED", e.message, e)
    }
  }

  private fun ensureIconCacheDir(): File {
    val dir = File(reactContext.cacheDir, "app_icons")
    if (!dir.exists()) dir.mkdirs()
    return dir
  }

  private fun cacheAppIcon(dir: File, packageName: String, drawable: Drawable?): String? {
    if (drawable == null) return null
    val safeName =
      packageName.lowercase(Locale.US).replace(Regex("[^a-z0-9._-]"), "_")
    val file = File(dir, "$safeName.png")
    try {
      // Régénère si absent ou trop petit (cache corrompu)
      if (!file.exists() || file.length() < 64) {
        val bitmap = drawableToBitmap(drawable, 128) ?: return null
        FileOutputStream(file).use { out ->
          if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)) return null
        }
        if (!bitmap.isRecycled) bitmap.recycle()
      }
      return "file://${file.absolutePath}"
    } catch (_: Exception) {
      return null
    }
  }

  private fun drawableToBitmap(drawable: Drawable, size: Int): Bitmap? {
    return try {
      when {
        drawable is BitmapDrawable && drawable.bitmap != null -> {
          Bitmap.createScaledBitmap(drawable.bitmap, size, size, true)
        }
        else -> {
          val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
          val canvas = Canvas(bmp)
          drawable.setBounds(0, 0, size, size)
          drawable.draw(canvas)
          bmp
        }
      }
    } catch (_: Exception) {
      null
    }
  }

  /**
   * Renvoie et vide la file des notifications reçues avant que le JS soit prêt.
   */
  @ReactMethod
  fun flushPendingNotifications(promise: Promise) {
    val drained: List<WritableMap>
    synchronized(pendingLock) {
      drained = ArrayList(pending)
      pending.clear()
    }
    val out: WritableArray = Arguments.createArray()
    for (item in drained) {
      out.pushMap(cloneMap(item))
    }
    promise.resolve(out)
  }

  /**
   * Extrait une URL depuis l'Intent de lancement (VIEW http(s) ou SHARE text).
   * Ignore les ouvertures marquées safedm_bypass_gate (évite la boucle navigateur).
   */
  @ReactMethod
  fun getLaunchUrl(promise: Promise) {
    try {
      val activity = reactContext.currentActivity
      val intent = activity?.intent
      val url = extractUrlFromIntent(intent)
      promise.resolve(url)
    } catch (e: Exception) {
      promise.reject("LAUNCH_URL_FAILED", e.message, e)
    }
  }

  /** True si SafeDM détient le rôle navigateur par défaut (Android 10+). */
  @ReactMethod
  fun isDefaultBrowser(promise: Promise) {
    try {
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
        val rm =
          reactContext.getSystemService(android.app.role.RoleManager::class.java)
        promise.resolve(
          rm != null &&
            rm.isRoleAvailable(android.app.role.RoleManager.ROLE_BROWSER) &&
            rm.isRoleHeld(android.app.role.RoleManager.ROLE_BROWSER),
        )
        return
      }
      promise.resolve(false)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /** Demande le rôle navigateur système → tous les clics http(s) passent par SafeDM. */
  @ReactMethod
  fun requestDefaultBrowserRole(promise: Promise) {
    try {
      val activity = reactContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "Activity indisponible")
        return
      }
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
        val rm = activity.getSystemService(android.app.role.RoleManager::class.java)
        if (rm != null && rm.isRoleAvailable(android.app.role.RoleManager.ROLE_BROWSER)) {
          if (rm.isRoleHeld(android.app.role.RoleManager.ROLE_BROWSER)) {
            promise.resolve(true)
            return
          }
          val intent = rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_BROWSER)
          activity.startActivity(intent)
          promise.resolve(true)
          return
        }
      }
      // Fallback : écran apps par défaut
      openDefaultAppsSettings()
      promise.resolve(false)
    } catch (e: Exception) {
      promise.reject("BROWSER_ROLE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun openDefaultAppsSettings() {
    try {
      val intent = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
    } catch (_: Exception) {
      val fallback = Intent(Settings.ACTION_SETTINGS)
      fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(fallback)
    }
  }

  /**
   * Ouvre l'URL dans un navigateur EXTERNE (jamais SafeDM) pour éviter la boucle
   * quand SafeDM est le navigateur par défaut.
   */
  @ReactMethod
  fun openUrlExternally(url: String, promise: Promise) {
    try {
      val uri = android.net.Uri.parse(url)
      val viewIntent = Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
      viewIntent.putExtra(EXTRA_BYPASS_GATE, true)
      val pm = reactContext.packageManager
      val candidates = pm.queryIntentActivities(viewIntent, 0)
      val external = candidates.firstOrNull {
        it.activityInfo?.packageName != null &&
          it.activityInfo.packageName != reactContext.packageName
      }
      if (external == null) {
        promise.reject("NO_BROWSER", "Aucun navigateur externe trouvé")
        return
      }
      viewIntent.setClassName(
        external.activityInfo.packageName,
        external.activityInfo.name,
      )
      viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(viewIntent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OPEN_EXTERNAL_FAILED", e.message, e)
    }
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
    const val KEY_CONFIGURED = "monitoring_configured"
    const val EVENT = "SafeDMNotification"
    const val LINK_EVENT = "SafeDMLinkIntent"
    const val EXTRA_BYPASS_GATE = "safedm_bypass_gate"
    private const val MAX_PENDING = 40
    private val URL_REGEX =
      Regex("""(?i)((?:https?://|www\.)[^\s<>"'\]]+)""")

    @Volatile
    var reactContext: ReactApplicationContext? = null

    private val pendingLock = Any()
    private val pending: MutableList<WritableMap> =
      Collections.synchronizedList(mutableListOf())

    fun extractUrlFromIntent(intent: Intent?): String? {
      if (intent == null) return null
      if (intent.getBooleanExtra(EXTRA_BYPASS_GATE, false)) return null

      when (intent.action) {
        Intent.ACTION_VIEW -> {
          val data = intent.dataString ?: return null
          if (data.startsWith("http://", true) || data.startsWith("https://", true)) {
            return data
          }
          // safedm://link?url=
          val uri = intent.data
          val nested = uri?.getQueryParameter("url")
          if (!nested.isNullOrBlank()) return nested
        }
        Intent.ACTION_SEND -> {
          val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return null
          val match = URL_REGEX.find(text)?.groupValues?.getOrNull(1) ?: return null
          return if (match.startsWith("www.", true)) "https://$match" else match
        }
      }
      return null
    }

    fun onNewIntent(intent: Intent?) {
      val url = extractUrlFromIntent(intent) ?: return
      val ctx = reactContext ?: return
      if (!ctx.hasActiveReactInstance()) return
      val map = Arguments.createMap()
      map.putString("url", url)
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(LINK_EVENT, map)
    }

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

    fun isMonitoringConfigured(context: Context): Boolean {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      return prefs.getBoolean(KEY_CONFIGURED, false)
    }

    fun emitNotification(payload: WritableMap) {
      val ctx = reactContext
      if (ctx == null || !ctx.hasActiveReactInstance()) {
        enqueue(payload)
        return
      }
      flushPendingToJs(ctx)
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT, payload)
    }

    private fun enqueue(payload: WritableMap) {
      synchronized(pendingLock) {
        if (pending.size >= MAX_PENDING) {
          pending.removeAt(0)
        }
        pending.add(cloneMap(payload))
      }
    }

    private fun flushPendingToJs(ctx: ReactApplicationContext) {
      val drained: List<WritableMap>
      synchronized(pendingLock) {
        if (pending.isEmpty()) return
        drained = ArrayList(pending)
        pending.clear()
      }
      val emitter = ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      for (item in drained) {
        emitter.emit(EVENT, item)
      }
    }

    private fun cloneMap(source: WritableMap): WritableMap {
      val copy = Arguments.createMap()
      copy.merge(source)
      return copy
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
