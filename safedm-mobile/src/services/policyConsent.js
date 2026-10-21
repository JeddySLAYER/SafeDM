import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "safedm_policy_consent_once_v1";

let presenter = null;

export function registerPolicyPresenter(fn) {
  presenter = fn;
  return () => {
    if (presenter === fn) presenter = null;
  };
}

export async function hasAcceptedPolicyOnce() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function markPolicyAcceptedOnce() {
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function showPolicyConsent({ title, body, confirmLabel, cancelLabel, remember = true } = {}) {
  return new Promise((resolve) => {
    (async () => {
      if (!presenter) {
        resolve(false);
        return;
      }
      if (remember) {
        const already = await hasAcceptedPolicyOnce().catch(() => false);
        if (already) {
          resolve(true);
          return;
        }
      }
      presenter({
        title,
        body,
        confirmLabel: confirmLabel || "J'accepte",
        cancelLabel: cancelLabel || "Refuser",
        resolve: (ok) => {
          if (ok && remember) {
            markPolicyAcceptedOnce();
          }
          resolve(ok);
        },
      });
    })();
  });
}
