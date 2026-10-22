export const FEATURE_COUNT = 50;
export const LOCAL_DECISION = Object.freeze({
  SAFE: "SAFE",
  UNCERTAIN: "UNCERTAIN",
  DANGEROUS: "DANGEROUS",
  UNAVAILABLE: "UNAVAILABLE",
});

// react-native-fast-tflite attend des TypedArray (ArrayBuffer.isView === true).
// Un ArrayBuffer brut passe la garde `#if DEBUG` en build debug mais fait
// echouer `TypedArrayBase::getBuffer()` en C++ (`no ArrayBuffer attached`).
// Cette exception n'est pas une `jsi::JSError` : elle traverse la frontière
// JSI et termine le process en build release (fermeture soudaine de l'app).
const TENSOR_ARRAY_TYPES = Object.freeze({
  float32: Float32Array,
  float64: Float64Array,
  int8: Int8Array,
  int16: Int16Array,
  int32: Int32Array,
  uint8: Uint8Array,
  uint16: Uint16Array,
  uint32: Uint32Array,
});

const TENSOR_VALUE_RANGES = Object.freeze({
  int8: [-128, 127],
  int16: [-32768, 32767],
  int32: [-2147483648, 2147483647],
  uint8: [0, 255],
  uint16: [0, 65535],
  uint32: [0, 4294967295],
});

export function decideLocalThreat(probability) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    return {
      decision: LOCAL_DECISION.UNAVAILABLE,
      confidence: null,
      riskScore: null,
    };
  }

  const riskScore = Math.round(probability * 100);
  if (probability >= 0.85) {
    return { decision: LOCAL_DECISION.DANGEROUS, confidence: probability, riskScore };
  }
  if (probability >= 0.4) {
    return { decision: LOCAL_DECISION.UNCERTAIN, confidence: probability, riskScore };
  }
  return { decision: LOCAL_DECISION.SAFE, confidence: probability, riskScore };
}

/**
 * Nombre d'éléments attendus par le tenseur d'entrée, ou null si la forme
 * n'est pas exploitable (dimension dynamique, descripteur absent).
 */
export function tensorElementCount(tensor) {
  const shape = tensor?.shape;
  if (!Array.isArray(shape) || shape.length === 0) return null;
  let total = 1;
  for (const dim of shape) {
    if (!Number.isInteger(dim) || dim <= 0) return null;
    total *= dim;
  }
  return total;
}

/**
 * Construit l'entrée du modèle local.
 *
 * @param {number[]} features vecteur uint8 de FEATURE_COUNT valeurs
 * @param {{dataType?: string, shape?: number[]}|null} tensor descripteur du
 *   tenseur d'entrée (`model.inputs[0]`), utilisé pour vérifier la forme et
 *   le type réellement attendus par le modèle.
 * @returns {Float32Array|Uint8Array|...} un TypedArray, jamais un ArrayBuffer
 */
export function createModelInput(features, tensor = null) {
  if (!Array.isArray(features) || features.length !== FEATURE_COUNT) {
    throw new Error(`Le modèle local attend ${FEATURE_COUNT} features`);
  }
  if (features.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error("Le vecteur local doit contenir des uint8");
  }

  const expected = tensorElementCount(tensor);
  if (expected !== null && expected !== features.length) {
    throw new Error(
      `Le modèle local attend ${expected} valeurs (reçu ${features.length})`,
    );
  }

  const dataType = String(tensor?.dataType || "").toLowerCase();
  const range = TENSOR_VALUE_RANGES[dataType];
  if (range && features.some((value) => value < range[0] || value > range[1])) {
    throw new Error(`Le vecteur local contient des valeurs hors bornes ${dataType}`);
  }

  const ArrayType = TENSOR_ARRAY_TYPES[dataType] || Float32Array;
  // On renvoie le TypedArray lui-même : c'est ce que le binding JSI attend.
  return new ArrayType(features);
}
