import { LOCAL_MODEL_URI } from "../config";
import { NativeModules } from "react-native";
import {
  createModelInput,
  decideLocalThreat,
  LOCAL_DECISION,
} from "./localThreatDecision";

let modelPromise;

async function loadModel() {
  const modelUri =
    LOCAL_MODEL_URI || require("../../assets/models/safedm_v3.tflite");
  if (!modelPromise) {
    modelPromise = (async () => {
      // Lazy require keeps Expo/Jest usable when the native dev client is not
      // installed. The production build must provide a valid model URI.
      const { loadTensorflowModel } = require("react-native-fast-tflite");
      return loadTensorflowModel({ url: modelUri }, []);
    })().catch((error) => {
      modelPromise = undefined;
      throw error;
    });
  }
  return modelPromise;
}

export async function classifyLocalFeatures(features) {
  const model = await loadModel();
  if (!model) {
    return { decision: LOCAL_DECISION.UNAVAILABLE, confidence: null, riskScore: null };
  }

  const outputs = await model.run([createModelInput(features)]);
  if (!Array.isArray(outputs) || outputs.length < 1) {
    throw new Error("Le modèle local n'a produit aucune sortie");
  }

  const scores = new Float32Array(outputs[0]);
  if (scores.length < 1) {
    throw new Error("La sortie du modèle local est vide");
  }
  return decideLocalThreat(scores[0]);
}

export async function classifyLocalMessage(text, packageName = null) {
  const bridge = NativeModules.SafeDMNotificationsModule;
  if (!bridge?.extractFeatures) {
    return { decision: LOCAL_DECISION.UNAVAILABLE, confidence: null, riskScore: null };
  }
  const features = await bridge.extractFeatures(text, packageName);
  return classifyLocalFeatures(features);
}
