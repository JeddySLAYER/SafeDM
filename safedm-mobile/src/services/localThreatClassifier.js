import { LOCAL_MODEL_URI } from "../config";
import { NativeModules } from "react-native";
import { decideWithPatch, getStoredModelUri, getStoredPatch } from "./modelUpdate";
import {
  createModelInput,
  decideLocalThreat,
  LOCAL_DECISION,
} from "./localThreatDecision";

let modelPromise;

async function loadModel() {
  const bundledModel = require("../../assets/models/safedm_v3.tflite");
  const modelUri = (await getStoredModelUri()) || LOCAL_MODEL_URI || bundledModel;
  if (!modelPromise) {
    modelPromise = (async () => {
      // Lazy require keeps Expo/Jest usable when the native dev client is not
      // installed. The production build must provide a valid model URI.
      const { loadTensorflowModel } = require("react-native-fast-tflite");
      // v2 API: source = require() asset id | { url }; delegate optional (default CPU)
      const source =
        typeof modelUri === "number" || typeof modelUri === "string"
          ? modelUri
          : { url: modelUri };
      return loadTensorflowModel(source);
    })().catch(async (error) => {
      modelPromise = undefined;
      if (modelUri !== bundledModel) {
        const { loadTensorflowModel } = require("react-native-fast-tflite");
        return loadTensorflowModel(bundledModel);
      }
      throw error;
    });
  }
  return modelPromise;
}

export async function classifyLocalFeatures(features) {
  const patch = await getStoredPatch();
  if (patch && decideWithPatch(patch, features) !== null) {
    const malicious = decideWithPatch(patch, features);
    return decideLocalThreat(malicious ? 0.95 : 0.05);
  }
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
  const features = await extractLocalFeatures(text, packageName);
  if (!features) {
    return { decision: LOCAL_DECISION.UNAVAILABLE, confidence: null, riskScore: null };
  }
  return classifyLocalFeatures(features);
}

export async function extractLocalFeatures(text, packageName = null) {
  // Must match SafeDMNotificationsModule.NAME ("SafeDMNotifications").
  const bridge = NativeModules.SafeDMNotifications;
  if (!bridge?.extractFeatures) {
    return null;
  }
  return bridge.extractFeatures(text, packageName);
}
