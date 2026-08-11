import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { monitoredPackages } from "../theme/tokens";

const { SafeDMNotifications } = NativeModules;
const PACKAGES_KEY = "safedm_monitored_packages";
const CONFIGURED_KEY = "safedm_monitoring_configured";

const fallbackEmitter = {
  addListener: () => ({ remove() {} }),
};

/**
 * Étend un package principal (ex. WhatsApp) à ses variantes connues
 * (Business, Samsung SMS, Outlook, etc.).
 */
export function expandMonitoredPackages(packageNames) {
  const selected = new Set(Array.isArray(packageNames) ? packageNames : []);
  const expanded = new Set(selected);
  Object.values(monitoredPackages).forEach((group) => {
    if (group.some((pkg) => selected.has(pkg))) {
      group.forEach((pkg) => expanded.add(pkg));
    }
  });
  return [...expanded];
}

export async function isNotificationAccessEnabled() {
  if (Platform.OS !== "android" || !SafeDMNotifications) {
    return false;
  }
  try {
    return Boolean(await SafeDMNotifications.isNotificationAccessEnabled());
  } catch {
    return false;
  }
}

export function openNotificationListenerSettings() {
  if (Platform.OS !== "android" || !SafeDMNotifications) {
    return;
  }
  SafeDMNotifications.openNotificationListenerSettings();
}

export async function syncMonitoredPackages(packageNames) {
  const expanded = expandMonitoredPackages(packageNames);
  await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(expanded));
  await AsyncStorage.setItem(CONFIGURED_KEY, "1");
  if (Platform.OS === "android" && SafeDMNotifications?.setMonitoredPackages) {
    SafeDMNotifications.setMonitoredPackages(expanded);
  }
  return expanded;
}

export async function getEnabledPackageNames() {
  const configured = await AsyncStorage.getItem(CONFIGURED_KEY);
  const raw = await AsyncStorage.getItem(PACKAGES_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fallthrough */
    }
  }
  // Jamais configuré → défauts ; configuré avec [] → aucune app
  if (configured === "1") return [];
  return Object.values(monitoredPackages).flat();
}

export function subscribeToNotifications(handler) {
  if (Platform.OS !== "android" || !SafeDMNotifications) {
    return fallbackEmitter.addListener();
  }
  const emitter = new NativeEventEmitter(SafeDMNotifications);
  return emitter.addListener("SafeDMNotification", handler);
}

/** Apps installées (lanceurs) pour le choix de surveillance libre. */
export async function listInstalledApps() {
  if (Platform.OS !== "android" || !SafeDMNotifications?.listInstalledApps) {
    return [];
  }
  try {
    const apps = await SafeDMNotifications.listInstalledApps();
    return Array.isArray(apps)
      ? apps
          .map((a) => ({
            name: a?.name || a?.packageName || "",
            packageName: a?.packageName || "",
          }))
          .filter((a) => a.packageName)
          .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      : [];
  } catch {
    return [];
  }
}

/** Vide la file native des notifs reçues avant que le JS soit prêt. */
export async function flushPendingNotifications() {
  if (Platform.OS !== "android" || !SafeDMNotifications?.flushPendingNotifications) {
    return [];
  }
  try {
    const pending = await SafeDMNotifications.flushPendingNotifications();
    return Array.isArray(pending) ? pending : [];
  } catch {
    return [];
  }
}

/** URL reçue via Intent VIEW / SHARE (null si aucune). */
export async function getLaunchUrl() {
  if (Platform.OS !== "android" || !SafeDMNotifications?.getLaunchUrl) {
    return null;
  }
  try {
    const url = await SafeDMNotifications.getLaunchUrl();
    return url || null;
  } catch {
    return null;
  }
}

export async function isDefaultBrowser() {
  if (Platform.OS !== "android" || !SafeDMNotifications?.isDefaultBrowser) {
    return false;
  }
  try {
    return Boolean(await SafeDMNotifications.isDefaultBrowser());
  } catch {
    return false;
  }
}

export function requestDefaultBrowserRole() {
  if (Platform.OS !== "android" || !SafeDMNotifications?.requestDefaultBrowserRole) {
    return Promise.resolve(false);
  }
  return SafeDMNotifications.requestDefaultBrowserRole();
}

export function openDefaultAppsSettings() {
  if (Platform.OS !== "android" || !SafeDMNotifications?.openDefaultAppsSettings) {
    return;
  }
  SafeDMNotifications.openDefaultAppsSettings();
}

/** Ouvre dans Chrome/Firefox etc. — jamais SafeDM (évite la boucle). */
export async function openUrlExternally(url) {
  if (Platform.OS === "android" && SafeDMNotifications?.openUrlExternally) {
    try {
      await SafeDMNotifications.openUrlExternally(url);
      return true;
    } catch {
      /* fallthrough */
    }
  }
  const { Linking } = require("react-native");
  await Linking.openURL(url);
  return true;
}

export function subscribeToLinkIntents(handler) {
  if (Platform.OS !== "android" || !SafeDMNotifications) {
    return fallbackEmitter.addListener();
  }
  const emitter = new NativeEventEmitter(SafeDMNotifications);
  return emitter.addListener("SafeDMLinkIntent", (event) => {
    if (event?.url) handler(event.url);
  });
}
