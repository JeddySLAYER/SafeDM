import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFS_KEY = "safedm_notification_prefs";
const DIGEST_KEY = "safedm_daily_digest";
const DEGRADED_KEY = "safedm_protection_off_notified";

/**
 * Les trois canaux Android.
 *
 * Un canal par niveau d'urgence, pour que l'utilisateur puisse les regler
 * separement dans les reglages systeme : couper les alertes de securite ne
 * doit pas faire disparaitre les informations de maintenance.
 */
export const NOTIFICATION_CHANNELS = {
  alerts: "alerts",
  info: "info",
  quiet: "quiet",
};

/**
 * Les types de notification SafeDM.
 *
 * Chaque type est un interrupteur independant dans les reglages, et un canal.
 * Le contenu du message n'est JAMAIS dans le corps par defaut : le titre et
 * le corps decrivent le risque, pas le message. Un extrait n'est ajoute que si
 * l'utilisateur n'a pas demande a masquer le contenu des alertes.
 */
export const NOTIFICATION_TYPES = {
  THREAT_DETECTED: "threat_detected",
  SUSPICIOUS_DETECTED: "suspicious_detected",
  LINK_BLOCKED: "link_blocked",
  MODEL_UPDATED: "model_updated",
  PROTECTION_OFF: "protection_off",
  DAILY_DIGEST: "daily_digest",
};

export const NOTIFICATION_TYPE_DETAILS = {
  [NOTIFICATION_TYPES.THREAT_DETECTED]: {
    channel: NOTIFICATION_CHANNELS.alerts,
    label: "Menace détectée",
    description: "Un message a été classé dangereux par le modèle local.",
    defaultEnabled: true,
  },
  [NOTIFICATION_TYPES.SUSPICIOUS_DETECTED]: {
    channel: NOTIFICATION_CHANNELS.alerts,
    label: "Message suspect",
    description: "Un message a déclenché des signaux d’alerte sans être classé comme dangereux.",
    defaultEnabled: true,
  },
  [NOTIFICATION_TYPES.LINK_BLOCKED]: {
    channel: NOTIFICATION_CHANNELS.alerts,
    label: "Lien bloqué",
    description: "Un lien dangereux a été bloqué avant ouverture.",
    defaultEnabled: true,
  },
  [NOTIFICATION_TYPES.MODEL_UPDATED]: {
    channel: NOTIFICATION_CHANNELS.info,
    label: "Modèle mis à jour",
    description: "Un nouveau modèle local a été installé sur cet appareil.",
    defaultEnabled: true,
  },
  [NOTIFICATION_TYPES.PROTECTION_OFF]: {
    channel: NOTIFICATION_CHANNELS.info,
    label: "Protection dégradée",
    description: "Le modèle local est indisponible ou une permission a été révoquée.",
    defaultEnabled: true,
  },
  [NOTIFICATION_TYPES.DAILY_DIGEST]: {
    channel: NOTIFICATION_CHANNELS.quiet,
    label: "Résumé quotidien",
    description: "Un récapitulatif des alertes de la journée, sans alerte immédiate.",
    defaultEnabled: false,
  },
};

const fallbackEmitter = {
  addListener: () => ({ remove() {} }),
};

function defaultPreferences() {
  const prefs = {};
  for (const [type, spec] of Object.entries(NOTIFICATION_TYPE_DETAILS)) {
    prefs[type] = spec.defaultEnabled;
  }
  return prefs;
}

/** Preferences de notification : un interrupteur par type. */
export async function getNotificationPreferences() {
  const defaults = defaultPreferences();
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    const merged = { ...defaults };
    for (const type of Object.keys(defaults)) {
      if (typeof parsed[type] === "boolean") merged[type] = parsed[type];
    }
    return merged;
  } catch {
    return defaults;
  }
}

export async function setNotificationEnabled(type, enabled) {
  if (!NOTIFICATION_TYPE_DETAILS[type]) return false;
  const prefs = await getNotificationPreferences();
  prefs[type] = Boolean(enabled);
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return prefs[type];
}

/**
 * Le module natif, lu a la demande.
 *
 * Pas de destructuration a l'import : le module peut etre enregistre apres le
 * chargement du bundle, et le garder dans une constante figerait un `undefined`
 * difficile a diagnostiquer.
 */
function nativeNotifier() {
  return NativeModules.SafeDMNotifier || null;
}

/**
 * Le module natif est absent sur iOS et sur les builds de test.
 *
 * On ne teste pas `Platform.OS` : la presence du module natif suffit, et
 * elle dit deja tout — il n'existe que sur Android. Tester la plateforme
 * empecherait par ailleurs de tester ce service sous Jest.
 */
export function isNotifierAvailable() {
  return Boolean(nativeNotifier());
}

/** L'utilisateur a-t-il autorise les notifications au systeme ? */
export async function areNotificationsEnabled() {
  const notifier = nativeNotifier();
  if (!notifier) return false;
  try {
    return Boolean(await notifier.areNotificationsEnabled());
  } catch {
    return false;
  }
}

/**
 * Autorise les notifications.
 *
 * Android 13 (API 33) introduce `POST_NOTIFICATIONS` : sur les versions
 * anteriores, l'autorisation est implicite et il n'y a rien a demander.
 */
export async function requestNotificationPermission() {
  if (Platform.OS !== "android") return false;
  if (Number(Platform.Version) < 33) return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Cree les canaux. A appeler une fois au demarrage. */
export async function ensureNotificationChannels() {
  const notifier = nativeNotifier();
  if (!notifier) return false;
  try {
    await notifier.ensureChannels();
    return true;
  } catch {
    return false;
  }
}

/** Ouvre la page systeme des notifications de l'application. */
export async function openNotificationSettings() {
  const notifier = nativeNotifier();
  if (!notifier) return false;
  try {
    await notifier.openNotificationSettings();
    return true;
  } catch {
    return false;
  }
}

/** Identifiant numerique stable, pour remplacer plutot qu'empiler. */
export function notificationIdFor(key) {
  const text = String(key || "safedm");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  // On evite 0 et les valeurs negatives : Android les traite a part.
  return (hash % 2000000000) + 1;
}

/**
 * Publie une notification, si le type est active et si le systeme l'autorise.
 *
 * Ne leve jamais : une notification qui echoue ne doit pas faire echouer
 * l'analyse qui l'a declenchee.
 */
export async function notify(type, { title, body, data } = {}) {
  const spec = NOTIFICATION_TYPE_DETAILS[type];
  if (!spec) return false;
  const notifier = nativeNotifier();
  if (!notifier) return false;
  try {
    const prefs = await getNotificationPreferences();
    if (!prefs[type]) return false;
    if (!(await areNotificationsEnabled())) return false;
    await ensureNotificationChannels();
    const payload = JSON.stringify({ type, ...(data || {}) });
    await notifier.postNotification({
      notificationId: notificationIdFor(data?.id || `${type}:${data?.id || "default"}`),
      channel: spec.channel,
      title: title || "SafeDM",
      body: body || "",
      data: payload,
    });
    return true;
  } catch {
    return false;
  }
}

/** Retire toutes les notifications SafeDM affichees. */
export async function cancelAllNotifications() {
  const notifier = nativeNotifier();
  if (!notifier) return false;
  try {
    await notifier.cancelAll();
    return true;
  } catch {
    return false;
  }
}

/** Evenement « l'utilisateur a touche une notification ». */
export function subscribeToNotificationTaps(handler) {
  const notifier = nativeNotifier();
  if (!notifier) return fallbackEmitter.addListener();
  const emitter = new NativeEventEmitter(notifier);
  return emitter.addListener("SafeDMNotificationTap", (event) => {
    const raw = event?.payload;
    if (!raw) return;
    try {
      handler(JSON.parse(raw));
    } catch {
      handler({});
    }
  });
}

/**
 * Payload de la notification qui a ouvert l'application (demarrage a froid).
 *
 * Consomme le payload : le JS ne traite l'ouverture qu'une fois.
 */
export async function consumeLaunchNotificationPayload() {
  const notifier = nativeNotifier();
  if (!notifier) return null;
  try {
    const raw = await notifier.getLaunchPayload();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Signale une degradation de la protection locale.
 *
 * Cadence volontairement faible : au plus une fois par jour. Le modele local
 * peut echouer sur un message particulier (extraction native indisponible,
 * tenseur refuse) sans que la protection soit reellement hors service ; c'est
 * l'echec repete qui merite un signalement, pas l'echec isole.
 */
export async function notifyProtectionDegraded(reason = "") {
  try {
    const last = Number(await AsyncStorage.getItem(DEGRADED_KEY)) || 0;
    const now = Date.now();
    if (now - last < 24 * 60 * 60 * 1000) return false;
    await AsyncStorage.setItem(DEGRADED_KEY, String(now));
    return await notify(NOTIFICATION_TYPES.PROTECTION_OFF, {
      title: "Protection dégradée",
      body: reason
        ? `L’analyse locale n’a pas pu conclure : ${reason}`
        : "L’analyse locale n’a pas pu conclure sur un message récent.",
      data: { id: `protection-off-${now}` },
    });
  } catch {
    return false;
  }
}

/**
 * Publie le resume quotidien, au plus une fois par jour.
 *
 * Le resume est emis a l'ouverture de l'application : il n'y a pas de
 *`travail en arriere-plan` (WorkManager) dans cette version, et un resume
 * envoye la nuit n'aurait aucun interet — l'utilisateur dort.
 */
export async function maybePostDailyDigest(alerts) {
  try {
    const prefs = await getNotificationPreferences();
    if (!prefs[NOTIFICATION_TYPES.DAILY_DIGEST]) return false;
    const last = Number(await AsyncStorage.getItem(DIGEST_KEY)) || 0;
    const now = Date.now();
    if (now - last < 24 * 60 * 60 * 1000) return false;
    const list = Array.isArray(alerts) ? alerts : [];
    if (!list.length) {
      await AsyncStorage.setItem(DIGEST_KEY, String(now));
      return false;
    }
    const dangerous = list.filter((a) => a?.level === "high").length;
    const posted = await notify(NOTIFICATION_TYPES.DAILY_DIGEST, {
      title: "Résumé SafeDM",
      body: `${list.length} alerte${list.length > 1 ? "s" : ""} sur les dernières 24 h${dangerous ? `, dont ${dangerous} à risque élevé` : ""}.`,
      data: { id: `digest-${now}` },
    });
    if (posted) await AsyncStorage.setItem(DIGEST_KEY, String(now));
    return posted;
  } catch {
    return false;
  }
}
