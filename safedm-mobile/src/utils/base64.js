const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i += 1) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/**
 * Encodage Base64 standard, sans Buffer et sans global natif.
 *
 * Pourquoi ne pas utiliser `Buffer.from(bytes).toString("base64")` :
 * `react-native-quick-crypto@1.1.7` exige `react-native-quick-base64@>=3`,
 * mais le projet epingle la 2.2.2 (compatibilite RN 0.76). Son `install()`
 * remplace `global.base64FromArrayBuffer` par un wrapper qui rappelle
 * `fromByteArray` de la 2.2.2 — qui appelle a son tour ce meme global. Toute
 * conversion Base64 par `Buffer` part donc en recursion infinie et finit en
 * `RangeError: Maximum call stack size exceeded`.
 *
 * Ce module n'utilise ni Buffer ni les globals : il est donc correct meme si
 * l'initialisation de `react-native-quick-crypto` change.
 */
export function bytesToBase64(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const hasSecond = i + 1 < bytes.length;
    const hasThird = i + 2 < bytes.length;
    const b1 = hasSecond ? bytes[i + 1] : 0;
    const b2 = hasThird ? bytes[i + 2] : 0;
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += hasSecond ? ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
    out += hasThird ? ALPHABET[b2 & 0x3f] : "=";
  }
  return out;
}

/**
 * Decodage Base64 standard (tolere l'URL-safe : `-`/`_` et absence de
 * padding). Comme `bytesToBase64`, aucun Buffer ni global natif.
 */
export function base64ToBytes(value) {
  const cleaned = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((cleaned.length * 3) / 4));
  let offset = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const c0 = LOOKUP[cleaned.charCodeAt(i)] ?? 0;
    const c1 = LOOKUP[cleaned.charCodeAt(i + 1)] ?? 0;
    const c2 = LOOKUP[cleaned.charCodeAt(i + 2)] ?? 0;
    const c3 = LOOKUP[cleaned.charCodeAt(i + 3)] ?? 0;
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (offset < out.length) out[offset] = (triple >> 16) & 0xff;
    offset += 1;
    if (offset < out.length) out[offset] = (triple >> 8) & 0xff;
    offset += 1;
    if (offset < out.length) out[offset] = triple & 0xff;
    offset += 1;
  }
  return out;
}
