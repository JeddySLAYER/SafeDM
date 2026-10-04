import { FINGERPRINT_PUBLIC_KEY } from "../config";

const AAD = new TextEncoder().encode("SafeDM-Fingerprint-v1");

function bytesToBase64(bytes) {
  const { Buffer } = require("react-native-quick-crypto");
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value) {
  const { Buffer } = require("react-native-quick-crypto");
  return Uint8Array.from(Buffer.from(value, "base64"));
}

export async function encryptPayload(payload) {
  if (!FINGERPRINT_PUBLIC_KEY || !globalThis.crypto?.subtle) {
    throw new Error("Le chiffrement des signalements n'est pas configuré.");
  }

  const publicKey = await crypto.subtle.importKey(
    "spki",
    base64ToBytes(FINGERPRINT_PUBLIC_KEY),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: AAD },
    key,
    plaintext,
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawKey,
  );
  return {
    encrypted_key: bytesToBase64(new Uint8Array(encryptedKey)),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export const encryptFingerprintPayload = encryptPayload;
