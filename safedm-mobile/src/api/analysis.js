import { apiRequest } from "./client";

function gateFromMessageAnalysis(result, url) {
  const status = (result?.status || "").toUpperCase();
  const severity = (result?.severity || "").toUpperCase();
  const score = result?.risk_score ?? 0;
  let decision = "WARN";
  let headline = "Lien suspect ou non vérifié — prudence";
  let can_open = true;
  if (status === "DANGEROUS" || severity === "HIGH" || severity === "CRITICAL" || score >= 65) {
    decision = "BLOCK";
    headline = "Lien dangereux — ouverture bloquée";
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

/**
 * Analyse un lien avant ouverture (Link Gate).
 * Essaie /analysis/link puis /analysis/url, puis fallback message.
 */
export async function analyzeUrl(url) {
  const body = { url };
  try {
    return await apiRequest("/analysis/link", { method: "POST", body });
  } catch (err) {
    if (err?.status !== 404) throw err;
  }
  try {
    return await apiRequest("/analysis/url", { method: "POST", body });
  } catch (err) {
    if (err?.status !== 404) throw err;
  }
  // Backend ancien sans endpoint dédié
  const result = await analyzeMessage({
    content: url,
    source: "MANUAL",
  });
  return gateFromMessageAnalysis(result, url);
}
