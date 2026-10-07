package com.safedmmobile.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.safedmmobile.features.FeatureExtraction

/**
 * Capture les notifications des packages surveillés (WhatsApp / SMS / Email).
 * Ne bloque ni ne modifie jamais les messages utilisateur.
 */
class SafeDMNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || sbn.isOngoing) return

    val packageName = sbn.packageName ?: return
    val configured = SafeDMNotificationsModule.isMonitoringConfigured(applicationContext)
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
    // Jamais configuré → defaults. Configuré + vide → rien. Sinon liste choisie.
    val allowed = when {
      !configured -> defaults
      stored.isEmpty() -> emptySet()
      else -> stored
    }
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

    // Extraction des features dans le code natif, avant l'emission vers le JS.
    //
    // Un echec ici ne doit jamais empeicher l'affichage de l'alerte : on transmet
    // un payload sans vecteur et le JS degrade. Mieux vaut une alerte sans
    // niveau qu'une alerte perdue.
    val features: IntArray? = try {
      FeatureExtraction.extract(
        listOfNotNull(title, text).joinToString(" — "),
        // `knownBadUrl` reste inconnu ici : la verification reseau demande un
        // consentement et sort de l'appareil. 128 = « pas verifie », et non
        // « sur » — le modele ne doit pas se laisser Eldormir par defaut
        // d'information.
        knownBadUrl = null,
      )
    } catch (t: Throwable) {
      // Log minimal : jamais le contenu du message.
      android.util.Log.w("SafeDMFeatures", "extraction failed: ${t.javaClass.simpleName}")
      null
    }

    val payload = SafeDMNotificationsModule.buildPayload(
      packageName = packageName,
      title = title,
      text = text,
      postTime = sbn.postTime,
      features = features,
      vectorHash = features?.let { LocalThreatModel.vectorHashOrNull(it) },
      similarityHash = SimilarityHash.compute(listOfNotNull(title, text).joinToString(" — ")),
    )
    SafeDMNotificationsModule.emitNotification(payload)
  }
}
