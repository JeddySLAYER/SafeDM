import { apiBaseUrl } from "../theme/tokens";
import { clearSession, getToken } from "../utils/storage";

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

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

  let response;
  try {
    response = await fetch(
      `${apiBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,
      {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
    );
  } catch {
    throw new ApiError(
      "Impossible de joindre le serveur. Vérifiez que l’API tourne.",
      0,
      null,
    );
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
      await clearSession();
    }
    throw new ApiError(
      formatDetail(data?.detail ?? data),
      response.status,
      data?.detail ?? data,
    );
  }

  return data;
}
