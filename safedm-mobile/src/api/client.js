import { API_BASE_URL } from "../config";
import { clearSession, getToken } from "../utils/storage";
import { notifySessionExpired } from "../services/sessionEvents";

export class ApiError extends Error {
  constructor(message, status, detail, requiresAuth = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    // `true` quand l'appel exigeait une session : l'ecran peut alors proposer
    // « Se connecter / Creer un compte » au lieu d'afficher une erreur morte.
    this.requiresAuth = requiresAuth;
  }
}

/**
 * Delai maximal d'une requete reseau.
 *
 * Sans plafond, `fetch` peut rester pending tres longtemps (reseau captif,
 * serveur injoignable). Au demarrage, cela bloquait le rendu de l'application
 * pendant toute la duree de l'attente.
 */
const DEFAULT_TIMEOUT_MS = 12000;

function formatDetail(detail) {
  if (detail == null) {
    return "Erreur réseau";
  }
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg || JSON.stringify(item))
      .join(" · ");
  }
  return JSON.stringify(detail);
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    headers: extraHeaders = {},
    timeout = DEFAULT_TIMEOUT_MS,
  } = options;

  const headers = {
    Accept: "application/json",
    ...extraHeaders,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let token = null;
  if (auth) {
    token = await getToken();
    if (!token) {
      // Pas de session : inutile d'aller sur le reseau pour y decouvrir un
      // 401. On leve l'erreur tout de suite, l'ecran affiche l'invitation a
      // se connecter.
      throw new ApiError(
        "Connectez-vous pour utiliser cette fonction.",
        401,
        null,
        true,
      );
    }
    headers.Authorization = `Bearer ${token}`;
  }

  // `AbortController` est la seule façon de plafonner une requete `fetch`
  // sous React Native : sans lui, le chargement depend de la patience du
  // reseau.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(
      `${API_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,
      {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      },
    );
  } catch (error) {
    const aborted = error?.name === "AbortError";
    throw new ApiError(
      aborted
        ? "Le serveur met trop de temps à répondre."
        : "Vérification distante indisponible.",
      aborted ? 408 : 0,
      null,
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return null;
  }

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
      // La session est invalide cote serveur : on la purge et on previent
      // l'interface pour qu'elle propose de se reconnecter au lieu d'afficher
      // « votre session a expiré » sans issue.
      await clearSession();
      notifySessionExpired();
    }
    const raw = formatDetail(data?.detail ?? data);
    const safe =
      response.status === 401
        ? path.includes("/auth/")
          ? raw && !/https?:\/\//i.test(raw) && raw.length < 140
            ? raw
            : "Identifiants incorrects."
          : "Votre session a expiré. Reconnectez-vous."
        : raw && !/https?:\/\//i.test(raw) && raw.length < 140
          ? raw
          : "La vérification distante n'a pas abouti.";
    throw new ApiError(
      safe,
      response.status,
      data?.detail ?? data,
      response.status === 401 && auth,
    );
  }

  return data;
}
