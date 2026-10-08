import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const KEYS = {
  token: "safedm_access_token",
  user: "safedm_user",
  onboardingDone: "safedm_intro_v2",
  setupDone: "safedm_setup_done",
  deviceId: "safedm_device_id",
  // Opt-in explicite a l'analyse cloud. Absent = refuse : le serveur applique
  // « pas de consentement, pas d'appel a un tiers ». Voir consent_external
  // dans AnalysisRequest.
  cloudConsent: "safedm_cloud_consent",
  hideSensitivePreview: "safedm_hide_sensitive_preview",
};

async function secureGet(key) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key, value) {
  try {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Device may lack secure storage in some test environments.
  }
}

/** L'utilisateur a-t-il autorise l'envoi de ses messages a l'analyse cloud ? */
export async function getCloudConsent() {
  return (await AsyncStorage.getItem(KEYS.cloudConsent)) === "true";
}

export async function setCloudConsent(enabled) {
  if (enabled) {
    await AsyncStorage.setItem(KEYS.cloudConsent, "true");
  } else {
    await AsyncStorage.removeItem(KEYS.cloudConsent);
  }
}

/** Masquer le texte des alertes dans les listes / apercus. */
export async function getHideSensitivePreview() {
  return (await AsyncStorage.getItem(KEYS.hideSensitivePreview)) === "true";
}

export async function setHideSensitivePreview(enabled) {
  if (enabled) {
    await AsyncStorage.setItem(KEYS.hideSensitivePreview, "true");
  } else {
    await AsyncStorage.removeItem(KEYS.hideSensitivePreview);
  }
}

export async function getToken() {
  const secure = await secureGet(KEYS.token);
  if (secure) return secure;

  // Migration one-shot depuis AsyncStorage (pre-Sprint 9).
  const legacy = await AsyncStorage.getItem(KEYS.token);
  if (legacy) {
    await secureSet(KEYS.token, legacy);
    await AsyncStorage.removeItem(KEYS.token);
    return legacy;
  }
  return null;
}

export async function setToken(token) {
  if (token == null) {
    await secureSet(KEYS.token, null);
    await AsyncStorage.removeItem(KEYS.token);
    return;
  }
  await secureSet(KEYS.token, token);
  await AsyncStorage.removeItem(KEYS.token);
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(KEYS.user);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setStoredUser(user) {
  if (user == null) {
    await AsyncStorage.removeItem(KEYS.user);
    return;
  }
  await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
}

export async function clearSession() {
  await secureSet(KEYS.token, null);
  await AsyncStorage.multiRemove([KEYS.token, KEYS.user]);
}

export async function isOnboardingDone() {
  const value = await AsyncStorage.getItem(KEYS.onboardingDone);
  return value === "1";
}

export async function setOnboardingDone() {
  await AsyncStorage.setItem(KEYS.onboardingDone, "1");
}

export async function isSetupDone() {
  const value = await AsyncStorage.getItem(KEYS.setupDone);
  return value === "1";
}

export async function setSetupDone() {
  await AsyncStorage.setItem(KEYS.setupDone, "1");
}

export async function getOrCreateDeviceId() {
  let id = await AsyncStorage.getItem(KEYS.deviceId);
  if (id) {
    return id;
  }
  id = `android-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(KEYS.deviceId, id);
  return id;
}
