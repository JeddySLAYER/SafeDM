import { DEFAULT_API_BASE } from "./config.js";

/**
 * Convertit une base d'API en motif d'origine Chrome.
 * `https://api.exemple.fr/api/v1` -> `https://api.exemple.fr/*`
 *
 * Les motifs Chrome ignorent le port : `http://localhost/*` couvre donc
 * `http://localhost:8000/api/v1`.
 */
export function originPatternFor(baseUrl) {
  const value = String(baseUrl || "").trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    return null;
  }
}

/**
 * Chrome bloque les `fetch` vers un hote absent des permissions.
 * L'UI des Parametres accepte n'importe quelle URL : on demande donc
 * l'autorisation a l'enregistrement, sinon l'analyse echoue sans explication.
 *
 * `chrome.permissions.request` doit etre appele depuis un geste utilisateur
 * (un clic) : Chrome rejette l'appel autrement.
 */
export async function ensureOriginAllowed(baseUrl) {
  const pattern = originPatternFor(baseUrl);
  if (!pattern) return false;
  if (!chrome?.permissions?.request) return true;

  try {
    if (await chrome.permissions.contains({ origins: [pattern] })) return true;
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}

/**
 * Etat de l'autorisation pour une base d'API, sans demande.
 *
 * Utilisable hors de tout geste utilisateur (service worker, popup) : une
 * demande y echouerait systematiquement.
 */
export async function isOriginAllowed(baseUrl) {
  const pattern = originPatternFor(baseUrl);
  if (!pattern) return false;
  if (!chrome?.permissions?.contains) return true;
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

/**
 * Base d'API reellement utilisee : celle enregistree, sinon celle par defaut.
 */
export async function resolveConfiguredBase(storedBase) {
  return (storedBase || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
}
