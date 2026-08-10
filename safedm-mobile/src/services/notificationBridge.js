import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { monitoredPackages } from "../theme/tokens";

const { SafeDMNotifications } = NativeModules;
const PACKAGES_KEY = "safedm_monitored_packages";

const fallbackEmitter = {
  addListener: () => ({ remove() {} }),
};

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
  const list = Array.isArray(packageNames) ? packageNames : [];
  await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(list));
  if (Platform.OS === "android" && SafeDMNotifications?.setMonitoredPackages) {
    SafeDMNotifications.setMonitoredPackages(list);
  }
}

export async function getEnabledPackageNames() {
  const raw = await AsyncStorage.getItem(PACKAGES_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fallthrough */
    }
  }
  return Object.values(monitoredPackages).flat();
}

export function subscribeToNotifications(handler) {
  if (Platform.OS !== "android" || !SafeDMNotifications) {
    return fallbackEmitter.addListener();
  }
  const emitter = new NativeEventEmitter(SafeDMNotifications);
  return emitter.addListener("SafeDMNotification", handler);
}
