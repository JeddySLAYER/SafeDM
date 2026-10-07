import { getAppIcon } from "./notificationBridge";

/** Cache mémoire des logos Android (file://) par package. */
const memory = new Map();
const inflight = new Map();

/**
 * Résout le vrai logo d'une app installée.
 * Déduplique les appels natifs pour éviter de saturer le bridge.
 */
export async function resolveAppIcon(packageName) {
  const pkg = (packageName || "").trim();
  if (!pkg) return null;
  if (memory.has(pkg)) return memory.get(pkg);
  if (inflight.has(pkg)) return inflight.get(pkg);

  const pending = getAppIcon(pkg)
    .then((uri) => {
      const value = uri || null;
      memory.set(pkg, value);
      inflight.delete(pkg);
      return value;
    })
    .catch(() => {
      memory.set(pkg, null);
      inflight.delete(pkg);
      return null;
    });

  inflight.set(pkg, pending);
  return pending;
}

export function fallbackIconForSource(source) {
  switch (source) {
    case "SMS":
      return "sms";
    case "Email":
      return "email";
    case "Manuel":
      return "search";
    case "WhatsApp":
      return "whatsapp";
    default:
      return "bell";
  }
}
