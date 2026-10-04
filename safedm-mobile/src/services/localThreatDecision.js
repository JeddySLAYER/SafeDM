export const FEATURE_COUNT = 50;
export const LOCAL_DECISION = Object.freeze({
  SAFE: "SAFE",
  UNCERTAIN: "UNCERTAIN",
  DANGEROUS: "DANGEROUS",
  UNAVAILABLE: "UNAVAILABLE",
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

export function createModelInput(features) {
  if (!Array.isArray(features) || features.length !== FEATURE_COUNT) {
    throw new Error(`Le modèle local attend ${FEATURE_COUNT} features`);
  }
  if (features.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error("Le vecteur local doit contenir des uint8");
  }
  return new Float32Array(features).buffer;
}
