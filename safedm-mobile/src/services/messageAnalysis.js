import { ApiError } from "../api/client";
import { analyzeFeatureVector, analyzeMessage } from "../api/analysis";
import { listLegalDocuments } from "../api/legal";
import { showDialog } from "./appDialog";
import { showPolicyConsent } from "./policyConsent";
import { getToken } from "../utils/storage";
import {
  classifyLocalFeatures,
  extractLocalFeatures,
} from "./localThreatClassifier";

const FEATURE_COUNT = 50;

/**
 * L'appareil possede-t-il une session ?
 *
 * La verification distante — envoi du texte ou des caracteristiques — exige
 * un compte. Mieux vaut le savoir avant l'appel : un 401 remonte ici ne doit
 * jamais se traduire par un « session expiree » sans issue, mais par une
 * invitation a se connecter ou a creer un compte.
 */
export async function hasSession() {
  try {
    return Boolean(await getToken());
  } catch {
    return false;
  }
}

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
    // Le 401 est traite en amont : l'ecran affiche une invitation a se
    // connecter. Rappeler « session expiree » ici serait une impasse — et
    // serait faux pour un visiteur qui n'a jamais eu de compte.
    if (err.status === 401 || err.status === 0) {
      return "Vérification distante indisponible.";
    }
    return "La vérification distante n'a pas abouti.";
  }
  return "Impossible d'analyser le message pour l'instant.";
}

function resultFromLocal(local) {
  const isDangerous = local.decision === "DANGEROUS";
  const isUncertain = local.decision === "UNCERTAIN";
  const riskScore = local.riskScore;
  let reasons = [];
  if (isDangerous) {
    reasons = [
      riskScore != null
        ? `Score de risque local élevé (${riskScore}%)`
        : "Indicateurs de menace détectés par le modèle local",
      "Urgence artificielle, demande de code/mot de passe ou lien suspect à surveiller",
    ];
  } else if (isUncertain) {
    reasons = [
      riskScore != null
        ? `Score de risque intermédiaire (${riskScore}%)`
        : "Signaux ambigus détectés par le modèle local",
      "Vérification recommandée avant d'agir",
    ];
  } else {
    reasons = [
      riskScore != null
        ? `Analyse locale - faible risque (${riskScore}%)`
        : "Aucun indicateur fort de menace détecté sur l'appareil",
    ];
  }
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
    reasons,
    recommendations:
      local.decision === "UNCERTAIN"
        ? [
            "Méfiez-vous des liens, codes reçus par SMS ou demandes d'argent",
            "Ouvrez les sites/applications officiels directement (sans cliquer sur le lien)",
          ]
        : local.decision === "DANGEROUS"
          ? [
              "Ne cliquez pas sur le lien ni ne répondez avec des informations sensibles",
              "Vérifiez par un canal officiel et signalez le message",
            ]
          : ["Si vous avez un doute, analysez le lien ou signalez le message"],
    urls: [],
    providers: { local: { available: true, model: local.modelSource || "local" } },
    model_source: local.modelSource || "local",
    content_stored: false,
  };
}

/**
 * Verification distante des caracteristiques (sans le texte du message).
 *
 * Renvoie `{ result }`, `{ requiresAuth: true }` ou `null` (l'utilisateur a
 * garde le resultat local).
 */
async function askRemoteFeatures(features, session) {
  const choice = session
    ? await showDialog({
        title: "Vérification supplémentaire",
        message:
          "Le contrôle sur le téléphone n'est pas certain. Autoriser une vérification sans envoyer le texte du message ?",
        actions: [
          { label: "Garder le résultat local", value: "local" },
          { label: "Vérifier", value: "remote", variant: "primary" },
        ],
      })
    : await showDialog({
        title: "Résultat incertain",
        message:
          "Le contrôle sur le téléphone n'est pas certain. La vérification sans envoi du texte demande un compte SafeDM.",
        actions: [
          { label: "Garder le résultat local", value: "local" },
          { label: "Créer un compte", value: "account", variant: "primary" },
        ],
      });

  if (choice === "account") {
    return { requiresAuth: true };
  }
  if (choice !== "remote") {
    return null;
  }
  try {
    return { result: await analyzeFeatureVector(features) };
  } catch (err) {
    if (err instanceof ApiError && (err.requiresAuth || err.status === 401)) {
      return { requiresAuth: true, cause: err };
    }
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
 *
 * Renvoie :
 * - `{ result }` : l'analyse a abouti ;
 * - `{ error }` : l'analyse a echoue (message affichable tel quel) ;
 * - `{ requiresAuth: true }` : la verification distante exige un compte.
 *   L'ecran remplace alors son bouton par une invitation a se connecter ou a
 *   creer un compte — jamais par un cul-de-sac.
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
      const remote = await askRemoteFeatures(features, await hasSession());
      if (remote?.requiresAuth) {
        return { requiresAuth: true, cause: remote.cause };
      }
      if (remote?.result) {
        return { result: remote.result };
      }
    }
    return { result: resultFromLocal(local) };
  }

  // Aucun resultat local : la verification distante est la seule voie, et elle
  // demande un compte. On le dit avant l'appel plutot que d'echouer sur un 401.
  if (!(await hasSession())) {
    return { requiresAuth: true };
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
    if (err instanceof ApiError && (err.requiresAuth || err.status === 401)) {
      return { requiresAuth: true, cause: err };
    }
    return { error: friendlyAnalysisError(err) };
  }
}
