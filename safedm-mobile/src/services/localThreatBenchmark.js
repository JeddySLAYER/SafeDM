import { loadTensorflowModel } from "react-native-fast-tflite";
import { createModelInput, FEATURE_COUNT } from "./localThreatDecision";

const DEFAULT_ITERATIONS = 1000;

/**
 * Mesure l'inférence sur l'appareil courant. A appeler depuis un dev client
 * ou une build release, jamais depuis Node/Jest.
 */
export async function benchmarkLocalModel(iterations = DEFAULT_ITERATIONS) {
  const model = await loadTensorflowModel(
    { url: require("../../assets/models/safedm_v3.tflite") },
    [],
  );
  const input = createModelInput(new Array(FEATURE_COUNT).fill(0));
  const samples = [];
  const now = () => globalThis.performance?.now?.() ?? Date.now();

  for (let index = 0; index < iterations; index += 1) {
    const start = now();
    await model.run([input]);
    samples.push(now() - start);
  }

  samples.sort((left, right) => left - right);
  const percentile = (ratio) => samples[Math.floor((samples.length - 1) * ratio)];
  return {
    iterations,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
  };
}
