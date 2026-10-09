import * as FileSystem from "expo-file-system";
import { APP_VERSION, MODEL_MANIFEST_PUBLIC_KEY } from "../config";

const ACTIVE_MODEL_KEY = "safedm_active_model_uri";
const ACTIVE_MANIFEST_KEY = "safedm_active_model_manifest";
const ACTIVE_PATCH_KEY = "safedm_active_model_patch";

function storage() {
  try {
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function isCanary(deviceId, percentage) {
  let hash = 0;
  for (const char of deviceId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 100 < percentage;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function verifyManifest(manifest) {
  if (!MODEL_MANIFEST_PUBLIC_KEY || !manifest.signature) return false;
  const unsigned = { ...manifest };
  delete unsigned.signature;
  const { Buffer } = require("react-native-quick-crypto");
  const key = await crypto.subtle.importKey(
    "spki",
    Uint8Array.from(Buffer.from(MODEL_MANIFEST_PUBLIC_KEY, "base64")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    Uint8Array.from(Buffer.from(manifest.signature, "base64")),
    new TextEncoder().encode(canonical(unsigned)),
  );
}

export async function getStoredModelUri() {
  const uri = await (storage()?.getItem(ACTIVE_MODEL_KEY) || null);
  if (!uri) return null;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? uri : null;
}

export async function getStoredPatch() {
  const raw = await storage()?.getItem(ACTIVE_PATCH_KEY);
  if (!raw) return null;
  try {
    const patch = JSON.parse(raw);
    return patch?.quantization?.weights ? patch : null;
  } catch {
    return null;
  }
}

export function decideWithPatch(patch, features) {
  const weights = patch?.quantization?.weights;
  const threshold = patch?.quantization?.threshold_score;
  if (!Array.isArray(weights) || weights.length !== features.length || !Number.isFinite(threshold)) {
    return null;
  }
  let total = Number(patch.quantization.intercept) || 0;
  for (let i = 0; i < weights.length; i += 1) total += weights[i] * features[i];
  return total >= threshold;
}

export async function offerModelUpdate({ ask, onStart } = {}) {
  const { apiRequest } = require("../api/client");
  const { getOrCreateDeviceId } = require("../utils/storage");
  const deviceId = await getOrCreateDeviceId();
  const manifest = await apiRequest("models/latest");
  const percentage = Number(manifest.rollout?.percentage) || 0;
  const stage = manifest.rollout?.stage;
  const inRollout = stage === "production" || (stage === "canary" && isCanary(deviceId, percentage));
  if (!inRollout) return { updated: false, reason: "not_in_canary" };
  const patch = manifest.patch;
  if (!patch?.quantization?.weights) return { updated: false, reason: "no_patch" };
  const store = storage();
  if (!store) throw new Error("AsyncStorage unavailable");
  const previous = await store.getItem(ACTIVE_MANIFEST_KEY);
  let previousVersion = "";
  try {
    previousVersion = JSON.parse(previous || "{}").version || "";
  } catch {
    previousVersion = "";
  }
  if (previousVersion && previousVersion === manifest.version) {
    return { updated: false, reason: "current" };
  }
  const accepted = ask ? await ask(manifest) : true;
  if (!accepted) return { updated: false, reason: "declined" };
  onStart?.();
  await store.multiSet([
    [ACTIVE_PATCH_KEY, JSON.stringify(patch)],
    [ACTIVE_MANIFEST_KEY, JSON.stringify({ version: manifest.version, rollout: manifest.rollout })],
  ]);
  return { updated: true, version: manifest.version };
}

export async function updateModelFromManifest() {
  const { apiRequest } = require("../api/client");
  const { getOrCreateDeviceId } = require("../utils/storage");
  const deviceId = await getOrCreateDeviceId();
  const manifest = await apiRequest(
    `models/latest?app_version=${encodeURIComponent(APP_VERSION)}`,
  );
  const percentage = Number(manifest.rollout?.percentage) || 0;
  const stage = manifest.rollout?.stage;
  const inRollout =
    stage === "production" || (stage === "canary" && isCanary(deviceId, percentage));
  if (!inRollout) {
    return { updated: false, reason: "not_in_canary" };
  }
  if (
    !manifest.model_url ||
    !/^https:\/\//i.test(manifest.model_url) ||
    !/^[a-f0-9]{64}$/i.test(manifest.artifact_sha256) ||
    !/^[a-z0-9._-]+$/i.test(manifest.version || "")
  ) {
    throw new Error("Invalid model manifest");
  }
  if (!(await verifyManifest(manifest))) {
    throw new Error("Model manifest signature invalid");
  }

  const target = `${FileSystem.documentDirectory}safedm-${manifest.version}.tflite`;
  const download = await FileSystem.downloadAsync(manifest.model_url, target);
  const bytes = await (await fetch(download.uri)).arrayBuffer();
  const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
  if (digest.toLowerCase() !== manifest.artifact_sha256.toLowerCase()) {
    await FileSystem.deleteAsync(download.uri, { idempotent: true });
    throw new Error("Downloaded model checksum mismatch");
  }
  const store = storage();
  if (!store) throw new Error("AsyncStorage unavailable");
  await store.multiSet([
    [ACTIVE_MODEL_KEY, download.uri],
    [ACTIVE_MANIFEST_KEY, JSON.stringify(manifest)],
  ]);
  return { updated: true, uri: download.uri, version: manifest.version };
}
