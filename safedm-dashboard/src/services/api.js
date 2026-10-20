const TOKEN_KEY = "safedm_admin_token";
const USER_KEY = "safedm_admin_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("safedm_admin_stats_cache");
    sessionStorage.removeItem("safedm_admin_operations_cache");
  }
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function formatDetail(detail) {
  if (!detail) return "Erreur API";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join(" · ");
  return JSON.stringify(detail);
}

const STATUS_MESSAGE = {
  401: "Session expirée. Reconnectez-vous.",
  403: "Accès refusé pour cette action.",
  404: "Élément introuvable — il a peut-être été supprimé.",
};

function apiErrorMessage(status, detail, path = "") {
  if (status === 0) return "Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.";
  if (status >= 500) return "Le serveur a rencontré une erreur. Réessayez dans un instant.";
  if (status === 401) {
    // Sur un échec de connexion, privilégier le message du backend
    if (path.includes("/auth/login")) {
      return detail || "Identifiants incorrects.";
    }
    return STATUS_MESSAGE[status] || detail || "Session expirée. Reconnectez-vous.";
  }
  return STATUS_MESSAGE[status] || detail;
}

export async function apiRequest(
  path,
  { method = "GET", body, auth = true, signal } = {},
) {
  const headers = { Accept: "application/json" };
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  const started = performance.now();
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError(apiErrorMessage(0, ""), 0, error?.message);
  }
  const ms = Math.round(performance.now() - started);
  if (import.meta.env.DEV) {
    // Aide à distinguer latence réseau/DB vs UI
    console.debug(`[api] ${method} ${path} → ${res.status} in ${ms}ms`);
  }
  // Expose last latency for optional UI (stats)
  if (typeof window !== "undefined") {
    window.__safedmLastApiMs = ms;
  }

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !path.includes("/auth/login")) clearSession();
    const detail = formatDetail(data?.detail ?? data);
    throw new ApiError(apiErrorMessage(res.status, detail, path), res.status, detail);
  }
  return data;
}
