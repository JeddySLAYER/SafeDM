import { apiRequest } from "./client";
import { encryptPayload } from "../services/fingerprintEnvelope";

function gateFromMessageAnalysis(result, url) {
  const status = (result?.status || "").toUpperCase();
  const severity = (result?.severity || "").toUpperCase();
  const score = result?.risk_score ?? 0;
  let decision = "WARN";
  let headline = "Lien suspect ou non vérifié. Prudence.";
  let can_open = true;
  if (status === "DANGEROUS" || severity === "HIGH" || severity === "CRITICAL" || score >= 65) {
    decision = "BLOCK";
    headline = "Lien dangereux. Ouverture bloquée.";
    can_open = false;
  } else if (status === "SAFE" && score < 35 && severity === "LOW") {
    decision = "ALLOW";
    headline = "Aucun signal critique. Ouverture autorisée.";
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

/**
 * Analyse un message.
 *
 * `consentExternal` doit refleter un consentement REEL de l'utilisateur, jamais
 * un `true` par defaut : le serveur refuse tout appel a un tiers sans ce
 * drapeau. Les écrans Home / Manuel / Détail doivent passer
 * `consentExternal` seulement après `getCloudConsent()` ou un prompt
 * explicite (`ensureContentUploadConsent`).
 */
export function analyzeMessage(payload) {
  return apiRequest("/analysis", {
    method: "POST",
    body: {
      content: payload.content,
      source: payload.source || "MANUAL",
      application_package: payload.application_package || null,
      title: payload.title || null,
      sender: payload.sender || null,
      consent_external: payload.consentExternal === true,
    },
  });
}

export function analyzeFeatureVector(features) {
  return encryptPayload({ features }).then((envelope) =>
    apiRequest("/analysis/features", {
      method: "POST",
      body: { ...envelope, consent_external: true },
    }),
  );
}

/**
 * Analyse un lien avant ouverture (Link Gate).
 * Essaie /analysis/link puis /analysis/url, puis fallback message.
 */
export async function analyzeUrl(url) {
  // Appele uniquement depuis LinkGateScreen, donc sur action explicite de
  // l'utilisateur : le consentement est ici mismo implicite dans le geste.
  const body = { url, consent_external: true };
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
    consentExternal: true,
  });
  return gateFromMessageAnalysis(result, url);
}
