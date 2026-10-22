/* eslint-env jest */

jest.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: jest.fn(async () => ({
    run: jest.fn(async () => [new Float32Array([0.9])]),
    inputs: [{ name: "input", dataType: "float32", shape: [1, 50] }],
  })),
}));

jest.mock("../../../../assets/models/safedm_v3.tflite", () => "mock-safedm-model");
jest.mock("../../config", () => ({ LOCAL_MODEL_URI: null }));

jest.mock("react-native", () => ({
  NativeModules: {
    SafeDMNotifications: {
      extractFeatures: jest.fn(async () => new Array(50).fill(3)),
    },
  },
}));

import { loadTensorflowModel } from "react-native-fast-tflite";
import {
  classifyLocalFeatures,
  classifyLocalMessage,
} from "../localThreatClassifier";

/** Le modele deja charge (le module met son `modelPromise` en cache). */
async function loadedModel() {
  const result = loadTensorflowModel.mock.results[0];
  return result ? await result.value : null;
}

describe("local TFLite classifier", () => {
  test("loads the bundled model and maps its output", async () => {
    const result = await classifyLocalFeatures(new Array(50).fill(7));

    expect(result.decision).toBe("DANGEROUS");
    expect(result.riskScore).toBe(90);
    expect(result.modelSource).toBe("tflite");
    expect(loadTensorflowModel).toHaveBeenCalledWith(expect.anything());
  });

  test("extracts the native vector before inference", async () => {
    const result = await classifyLocalMessage("message de test");

    expect(result.decision).toBe("DANGEROUS");
  });

  test("hands a TypedArray to the native binding, never a bare ArrayBuffer", async () => {
    // react-native-fast-tflite lit l'entree via ArrayBuffer.isView puis
    // TypedArrayBase::getBuffer(). Un ArrayBuffer brut y fait lever une
    // std::runtime_error qui traverse la frontiere JSI : le process est
    // termine (fermeture soudaine) au lieu de lever une erreur JS rattrapable.
    await classifyLocalFeatures(new Array(50).fill(7));

    const model = await loadedModel();
    const calls = model.run.mock.calls;
    const [inputs] = calls[calls.length - 1];

    expect(inputs).toHaveLength(1);
    expect(ArrayBuffer.isView(inputs[0])).toBe(true);
    expect(inputs[0]).not.toBeInstanceOf(ArrayBuffer);
    expect(inputs[0]).toBeInstanceOf(Float32Array);
    expect(inputs[0]).toHaveLength(50);
  });

  test("refuses a feature vector that does not fit the declared tensor", async () => {
    const model = await loadedModel();
    const original = model.inputs[0].shape;
    model.inputs[0].shape = [1, 64];

    try {
      await expect(classifyLocalFeatures(new Array(50).fill(7))).rejects.toThrow(
        /attend 64/,
      );
    } finally {
      model.inputs[0].shape = original;
    }
  });
});
