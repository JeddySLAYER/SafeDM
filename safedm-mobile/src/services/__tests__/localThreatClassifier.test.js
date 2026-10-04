/* eslint-env jest */

jest.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: jest.fn(async () => ({
    run: jest.fn(async () => [new Float32Array([0.9]).buffer]),
  })),
}));

jest.mock("../../../../assets/models/safedm_v3.tflite", () => "mock-safedm-model");
jest.mock("../../config", () => ({ LOCAL_MODEL_URI: null }));

jest.mock("react-native", () => ({
  NativeModules: {
    SafeDMNotificationsModule: {
      extractFeatures: jest.fn(async () => new Array(50).fill(3)),
    },
  },
}));

import { loadTensorflowModel } from "react-native-fast-tflite";
import {
  classifyLocalFeatures,
  classifyLocalMessage,
} from "../localThreatClassifier";

describe("local TFLite classifier", () => {
  test("loads the bundled model and maps its output", async () => {
    const result = await classifyLocalFeatures(new Array(50).fill(7));

    expect(result.decision).toBe("DANGEROUS");
    expect(result.riskScore).toBe(90);
    expect(loadTensorflowModel).toHaveBeenCalledWith(
      { url: expect.anything() },
      [],
    );
  });

  test("extracts the native vector before inference", async () => {
    const result = await classifyLocalMessage("message de test");

    expect(result.decision).toBe("DANGEROUS");
  });
});
