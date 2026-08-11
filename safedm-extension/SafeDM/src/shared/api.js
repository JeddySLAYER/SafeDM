import { DEFAULT_API_BASE } from "./config.js";
import { clearSession, getApiBase, getToken, setSession } from "./storage.js";

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function formatDetail(detail) {
  if (detail == null) return "Erreur réseau";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(" · ");
  }
  return JSON.stringify(detail);
}

async function resolveBaseUrl() {
  const override = await getApiBase();
  return (override || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    headers: extraHeaders = {},
  } = options;

  const headers = {
    Accept: "application/json",
    ...extraHeaders,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const base = await resolveBaseUrl();
  let response;
  try {
    response = await fetch(`${base}/${path.replace(/^\/+/, "")}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Impossible de joindre le serveur SafeDM. Vérifiez la connexion.",
      0,
      null,
    );
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      await clearSession();
    }
    const detail = data?.detail ?? data;
    throw new ApiError(formatDetail(detail), response.status, detail);
  }

  return data;
}

export async function login(username, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    auth: false,
    body: { username, password },
  });
  const token = data?.access_token;
  if (!token) {
    throw new ApiError("Réponse login invalide (pas de token).", 0, data);
  }
  await setSession({ accessToken: token, username });
  return data;
}

export async function logout() {
  await clearSession();
}

export function analyzeMessage(payload) {
  return apiRequest("/analysis", {
    method: "POST",
    body: {
      content: payload.content,
      source: payload.source || "MANUAL",
      application_package: payload.application_package || null,
      title: payload.title || null,
      sender: payload.sender || null,
    },
  });
}

function gateFromMessageAnalysis(result, url) {
  const status = (result?.status || "").toUpperCase();
  const severity = (result?.severity || "").toUpperCase();
  const score = result?.risk_score ?? 0;
  let decision = "WARN";
  let headline = "Lien suspect ou non vérifié — prudence";
  let can_open = true;
  if (
    status === "DANGEROUS" ||
    severity === "HIGH" ||
    severity === "CRITICAL" ||
    score >= 65
  ) {
    decision = "BLOCK";
    headline = "Lien dangereux — ouverture déconseillée";
    can_open = false;
  } else if (status === "SAFE" && score < 35 && severity === "LOW") {
    decision = "ALLOW";
    headline = "Aucun signal critique — ouverture autorisée";
    can_open = true;
  }
  return {
    ...result,
    decision,
    url,
    domain: result?.urls?.[0]?.domain || null,
    headline,
    can_open,
  };
}

/** Normalize analysis / link-gate payload for UI. */
export function normalizeResult(result, fallbackText = "") {
  if (!result) {
    return {
      decision: "WARN",
      headline: "Résultat indisponible",
      risk_score: null,
      status: null,
      severity: null,
      url: fallbackText,
      can_open: true,
      summary: null,
    };
  }

  const decision = (result.decision || "").toUpperCase();
  if (decision === "ALLOW" || decision === "WARN" || decision === "BLOCK") {
    return {
      ...result,
      decision,
      headline:
        result.headline ||
        (decision === "ALLOW"
          ? "Aucun signal critique"
          : decision === "BLOCK"
            ? "Contenu dangereux"
            : "Prudence recommandée"),
      can_open: result.can_open ?? decision !== "BLOCK",
    };
  }

  return gateFromMessageAnalysis(result, result.url || fallbackText);
}

/**
 * Analyse un lien (Link Gate) avec fallbacks comme le mobile.
 */
export async function analyzeUrl(url) {
  const body = { url };
  try {
    const result = await apiRequest("/analysis/link", { method: "POST", body });
    return normalizeResult(result, url);
  } catch (err) {
    if (err?.status !== 404) throw err;
  }
  try {
    const result = await apiRequest("/analysis/url", { method: "POST", body });
    return normalizeResult(result, url);
  } catch (err) {
    if (err?.status !== 404) throw err;
  }
  const result = await analyzeMessage({ content: url, source: "MANUAL" });
  return gateFromMessageAnalysis(result, url);
}

export async function analyzeText(content) {
  const result = await analyzeMessage({ content, source: "MANUAL" });
  return normalizeResult(result, content);
}

const URL_RE = /^https?:\/\/\S+/i;

export function looksLikeUrl(text) {
  const t = (text || "").trim();
  return URL_RE.test(t);
}

export async function analyzeContent(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new ApiError("Aucun contenu à analyser.", 0, null);
  }
  if (looksLikeUrl(trimmed)) {
    return analyzeUrl(trimmed);
  }
  return analyzeText(trimmed);
}
