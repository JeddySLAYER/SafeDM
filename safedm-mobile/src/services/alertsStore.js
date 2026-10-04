import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyzeMessage } from "../api/analysis";
import { getCloudConsent, getToken } from "../utils/storage";
import { statusToLevel } from "../utils/risk";
import { emitAlertsChanged } from "./alertsEvents";
import { classifyLocalFeatures } from "./localThreatClassifier";

const KEY = "safedm_local_alerts";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ALERTS = 200;

let writeChain = Promise.resolve();

function sourceFromPackage(packageName = "") {
  if (packageName.includes("whatsapp")) return "WhatsApp";
  if (
    packageName.includes("messaging") ||
    packageName.includes("mms") ||
    packageName.includes("sms")
  ) {
    return "SMS";
  }
  if (
    packageName.includes("gm") ||
    packageName.includes("outlook") ||
    packageName.includes("mail")
  ) {
    return "Email";
  }
  return "Autre";
}

/** Doit rester aligne avec FEATURE_COUNT de app/utils/feature_extraction.py. */
const FEATURE_COUNT = 50;

function guessLevel(text = "") {
  const lower = text.toLowerCase();
  const highHints = [
    "mot de passe",
    "otp",
    "urgent",
    "validez",
    "cliquez",
    "compte bloqué",
  ];
  const hasUrl = /https?:\/\//i.test(text) || /bit\.ly|tinyurl/i.test(text);
  if (highHints.some((h) => lower.includes(h)) && hasUrl) return "high";
  if (hasUrl || highHints.some((h) => lower.includes(h))) return "medium";
  return "unknown";
}

async function readAll() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(items) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  emitAlertsChanged();
}

/** Sérialise les écritures pour éviter les courses concurrentes. */
function enqueueWrite(task) {
  const run = writeChain.then(task, task);
  writeChain = run.catch(() => {});
  return run;
}

function purge(items) {
  const now = Date.now();
  return items.filter((a) => now - (a.createdAt || 0) <= RETENTION_MS);
}

export async function listAlerts() {
  const all = await readAll();
  const items = purge(all);
  if (items.length !== all.length) {
    await writeAll(items);
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAlertById(id) {
  const items = await listAlerts();
  return items.find((a) => a.id === id) || null;
}

export async function updateAlert(id, patch) {
  return enqueueWrite(async () => {
    const items = await readAll();
    const next = items.map((a) => (a.id === id ? { ...a, ...patch } : a));
    await writeAll(next);
    return next.find((a) => a.id === id) || null;
  });
}

/**
 * Niveau de repli, calcule a partir du VECTEUR natif.
 *
 * On ne reapplique pas une detection lexicale en JS : le contrat V3 est deja
 * applique par `FeatureExtraction.kt`, et deux listes de mots-clefs
 * divergeraient forcement. On se contente donc de traduire les features en
 * niveau, ce qui garde une seule source de verite (le code natif).
 *
 * `guessLevel()` reste le filet de securite pour le cas ou `features` est
 * absent : l'extraction native peut avoir echoue, et mieux vaut une alerte
 * approximate qu'une alerte perdue ou un `undefined` dans l'UI.
 *
 * @param {number[]|null|undefined} features les 50 uint8 du contrat V3
 */
function levelFromFeatures(features) {
  if (!Array.isArray(features) || features.length !== FEATURE_COUNT) return null;

  // Indices du contrat V3 ; voir docs/FEATURE_SCHEMA.md.
  const [
    , // 0 has_url
    , // 1 url_count
    shortenedUrl, // 2
    ipUrl, // 3
    , // 4 punycode
    suspiciousTld, // 5
    , // 6 non_https_url
    , // 7 url_atypical_port
    , // 8 deep_subdomain
    , // 9 brand_in_subdomain
    , // 10 url_host_digit_ratio
    , // 11 url_userinfo
    , // 12 url_query_count
    , // 13 url_executable_extension
    , // 14 url_hyphen_count
    knownBadUrl, // 15
    urgency, // 16
    credentials, // 17
    sensitive, // 18
    payment, // 19
    threat, // 20
    imperativeCta, // 21
    crypto, // 22
    , // 23 otp_code
    , // 24 account_word
    , // 25 bank_word
    , // 26 delivery_word
    , // 27 prize_word
    , // 28 refund_word
    , // 29 money_amount
    , // 30 phone_number
    , // 31 authority_claim
    , // 32 urgency_count
    , // 33 question_count
    , // 34 first_person_pressure
    salutation, // 35 personal_salutation
    lengthScore, // 36 message_length
    exclamation, // 37
    allCaps, // 38
    , // 39 digit_ratio
    obfuscation, // 40
  ] = features;

  // Le modele local decide in fine. Cette fonction ne fait que classer les
  // messages que le modele n'a pas traites (canary, ou modele absent).
  const strong = [credentials, sensitive, payment, threat].filter((v) => v >= 128).length;
  const weak = [urgency, imperativeCta, salutation].filter((v) => v > 0).length;
  const linkRisk = [shortenedUrl, ipUrl, suspiciousTld].filter((v) => v >= 128).length;

  if (knownBadUrl >= 128 || strong >= 2 || (strong >= 1 && linkRisk >= 1)) return "high";
  if (linkRisk >= 1 || strong >= 1 || weak >= 2 || obfuscation >= 128 || crypto >= 128) {
    return "medium";
  }
  if (lengthScore >= 120 || exclamation >= 128 || allCaps >= 200) return "low";
  return "unknown";
}

export async function addAlertFromNotification(payload) {
  const text = [payload.title, payload.text].filter(Boolean).join(" — ");
  if (!text.trim()) return null;

  const features = Array.isArray(payload.features) ? payload.features : null;
  let localDecision = null;
  if (features) {
    try {
      localDecision = await classifyLocalFeatures(features);
    } catch {
      localDecision = null;
    }
  }
  const localLevel =
    localDecision?.decision === "DANGEROUS"
      ? "high"
      : localDecision?.decision === "UNCERTAIN"
        ? "medium"
        : localDecision?.decision === "SAFE"
          ? "low"
          : levelFromFeatures(features);

  const alert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: sourceFromPackage(payload.packageName),
    packageName: payload.packageName || "",
    preview: text.slice(0, 160),
    fullText: text.slice(0, 2000),
    level: localLevel || guessLevel(text),
    riskScore: localDecision?.riskScore ?? null,
    features: features || null,
    vectorHash: payload.vectorHash || null,
    similarityHash: payload.similarityHash || null,
    decisionSource: localDecision ? "local-model" : localLevel ? "feature-fallback" : "heuristic-fallback",
    createdAt: payload.postTime || Date.now(),
    analyzed: false,
    origin: "notification",
  };

  await enqueueWrite(async () => {
    const items = purge(await readAll());
    items.unshift(alert);
    await writeAll(items.slice(0, MAX_ALERTS));
  });

  // Enrichissement backend best-effort — ne bloque jamais le flux NLS.
  //
  // Sans consentement, on n'appelle PAS le serveur : le contenu ne doit pas
  // quitter l'appareil. Le flag `consent_external` du serveur est une defense
  // en profondeur (il refuse meme si un client oublie), mais envoyer vers notre
  // propre backend reste une sortie de donnees.
  //
  // Le verdict vient alors du modele local uniquement.
  try {
    const token = await getToken();
    const consentExternal = await getCloudConsent();
    if (token && consentExternal && text.length >= 8) {
      const result = await analyzeMessage({
        content: text,
        source: "NOTIFICATION",
        application_package: payload.packageName,
        title: payload.title || null,
        consentExternal: true,
      });
      await updateAlert(alert.id, {
        level: statusToLevel(result.status, result.severity),
        riskScore: result.risk_score,
        status: result.status,
        reasons: result.reasons || [],
        analyzed: true,
        analysisResult: result,
      });
    }
  } catch {
    // garde l’heuristique locale
  }

  return alert;
}

/** Enregistre une analyse manuelle dans l’historique local 7 jours. */
export async function addAlertFromManualAnalysis({ content, result, sourceLabel = "Manuel" }) {
  const text = (content || "").trim();
  if (text.length < 8) return null;

  const alert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: sourceLabel,
    packageName: "",
    preview: text.slice(0, 160),
    fullText: text.slice(0, 2000),
    level: statusToLevel(result?.status, result?.severity),
    riskScore: result?.risk_score,
    status: result?.status,
    reasons: result?.reasons || [],
    createdAt: Date.now(),
    analyzed: true,
    origin: "manual",
    analysisResult: result || null,
  };

  await enqueueWrite(async () => {
    const items = purge(await readAll());
    items.unshift(alert);
    await writeAll(items.slice(0, MAX_ALERTS));
  });

  return alert;
}

export function formatAlertWhen(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
  if (sameDay) return `Aujourd'hui à ${time}`;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
