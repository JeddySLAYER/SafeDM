import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "safedm_local_alerts";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function sourceFromPackage(packageName = "") {
  if (packageName.includes("whatsapp")) return "WhatsApp";
  if (
    packageName.includes("messaging") ||
    packageName.includes("mms") ||
    packageName.includes("sms")
  ) {
    return "SMS";
  }
  if (packageName.includes("gm") || packageName.includes("outlook") || packageName.includes("mail")) {
    return "Email";
  }
  return "Autre";
}

function guessLevel(text = "") {
  const lower = text.toLowerCase();
  const highHints = ["mot de passe", "otp", "urgent", "validez", "cliquez", "compte bloqué"];
  const hasUrl = /https?:\/\//i.test(text) || /bit\.ly|tinyurl/i.test(text);
  if (highHints.some((h) => lower.includes(h)) && hasUrl) return "high";
  if (hasUrl || highHints.some((h) => lower.includes(h))) return "medium";
  return "unknown";
}

async function readAll() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(items) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function listAlerts() {
  const now = Date.now();
  const items = (await readAll()).filter((a) => now - a.createdAt <= RETENTION_MS);
  if (items.length !== (await readAll()).length) {
    await writeAll(items);
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addAlertFromNotification(payload) {
  const text = [payload.title, payload.text].filter(Boolean).join(" — ");
  if (!text.trim()) return null;

  const alert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: sourceFromPackage(payload.packageName),
    packageName: payload.packageName,
    preview: text.slice(0, 160),
    level: guessLevel(text),
    createdAt: payload.postTime || Date.now(),
  };

  const items = await listAlerts();
  items.unshift(alert);
  await writeAll(items.slice(0, 200));
  return alert;
}
