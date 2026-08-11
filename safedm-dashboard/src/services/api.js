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
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function formatDetail(detail) {
  if (!detail) return "Erreur API";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join(" · ");
  return JSON.stringify(detail);
}

export async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  const started = performance.now();
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
    if (res.status === 401) clearSession();
    throw new ApiError(formatDetail(data?.detail ?? data), res.status);
  }
  return data;
}
