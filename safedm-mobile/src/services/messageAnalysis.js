import { ApiError } from "../api/client";
import { analyzeFeatureVector, analyzeMessage } from "../api/analysis";
import { listLegalDocuments } from "../api/legal";
import { showDialog } from "./appDialog";
import { showPolicyConsent } from "./policyConsent";
import {
  classifyLocalFeatures,
  extractLocalFeatures,
} from "./localThreatClassifier";

const FEATURE_COUNT = 50;

export function normalizeFeatures(raw) {
  if (raw == null) return null;
  const list = Array.isArray(raw) ? raw : Array.from(raw);
  if (list.length !== FEATURE_COUNT) return null;
  const ints = list.map((value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : NaN;
  });
  if (ints.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return ints;
}

export function friendlyAnalysisError(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expirée. Reconnectez-vous.";
    if (err.status === 0) {
      return "Vérification distante indisponible. Le message reste sur le téléphone.";
    }
    return "La vérification distante n'a pas abouti. Le message reste sur le téléphone.";
  }
  return "Analyse impossible pour le moment. Le message reste sur le téléphone.";
}

function resultFromLocal(local) {
  return {
    status:
      local.decision === "DANGEROUS"
        ? "DANGEROUS"
        : local.decision === "SAFE"
          ? "SAFE"
          : "PARTIAL",
    risk_score: local.riskScore,
    severity:
      local.decision === "DANGEROUS"
        ? "HIGH"
        : local.decision === "UNCERTAIN"
          ? "MEDIUM"
          : "LOW",
    reasons: ["Contrôle effectué sur le téléphone"],
    recommendations:
      local.decision === "UNCERTAIN"
        ? ["Le résultat n'est pas certain. Méfiez-vous des liens et des demandes d'argent."]
        : [],
    urls: [],
    providers: { local: { available: true } },
    content_stored: false,
  };
}

async function askRemoteFeatures(features) {
  const choice = await showDialog({
    title: "Vérification supplémentaire",
    message:
      "Le contrôle sur le téléphone n'est pas certain. Autoriser une vérification sans envoyer le texte du message ?",
    actions: [
      { label: "Garder le résultat local", value: "local" },
      { label: "Vérifier", value: "remote", variant: "primary" },
    ],
  });
  if (choice !== "remote") return null;
  try {
    return await analyzeFeatureVector(features);
  } catch {
    return null;
  }
}

async function askRemoteText(text) {
  let privacy = null;
  try {
    const docs = await listLegalDocuments();
    privacy = (docs || []).find((doc) => doc.slug === "privacy");
  } catch {
    privacy = null;
  }
  const accepted = await showPolicyConsent({
    title: privacy?.title || "Politique de confidentialité",
    body:
      privacy?.body ||
      "Le texte de ce message quitte le téléphone uniquement si vous acceptez cette vérification.",
    confirmLabel: "J'accepte et j'envoie",
    cancelLabel: "Ne pas envoyer",
  });
  if (!accepted) return null;
  return analyzeMessage({
    content: text,
    source: "MANUAL",
    consentExternal: true,
  });
}

/**
 * Analyse un message collé. Le modèle local est essayé en premier.
 * Renvoie { result } ou { error }.
 */
export async function analyzePastedText(text) {
  let features = null;
  let local = null;
  try {
    features = normalizeFeatures(await extractLocalFeatures(text));
    if (features) {
      local = await classifyLocalFeatures(features);
    }
  } catch {
    features = null;
    local = null;
  }

  if (local && local.decision !== "UNAVAILABLE") {
    if (local.decision === "UNCERTAIN" && features) {
      const remote = await askRemoteFeatures(features);
      if (remote) return { result: remote };
    }
    return { result: resultFromLocal(local) };
  }

  try {
    const remote = await askRemoteText(text);
    if (!remote) {
      return {
        error:
          "Rien n'a été envoyé. Réessayez, ou activez la vérification distante dans Paramètres.",
      };
    }
    return { result: remote };
  } catch (err) {
    return { error: friendlyAnalysisError(err) };
  }
}
