import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  token: "safedm_access_token",
  user: "safedm_user",
  onboardingDone: "safedm_onboarding_done",
  setupDone: "safedm_setup_done",
  deviceId: "safedm_device_id",
};

export async function getToken() {
  return AsyncStorage.getItem(KEYS.token);
}

export async function setToken(token) {
  if (token == null) {
    await AsyncStorage.removeItem(KEYS.token);
    return;
  }
  await AsyncStorage.setItem(KEYS.token, token);
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
