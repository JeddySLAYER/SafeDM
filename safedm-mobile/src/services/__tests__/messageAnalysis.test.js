/* eslint-env jest */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("../../utils/storage", () => ({
  getToken: jest.fn(),
  clearSession: jest.fn(),
}));

jest.mock("../../api/analysis", () => ({
  analyzeMessage: jest.fn(),
  analyzeFeatureVector: jest.fn(),
}));

jest.mock("../../api/legal", () => ({
  listLegalDocuments: jest.fn(async () => []),
}));

jest.mock("../localThreatClassifier", () => ({
  extractLocalFeatures: jest.fn(),
  classifyLocalFeatures: jest.fn(),
}));

jest.mock("../appDialog", () => ({
  showDialog: jest.fn(async () => "local"),
}));

import { ApiError } from "../../api/client";
import { analyzeFeatureVector, analyzeMessage } from "../../api/analysis";
import { showDialog } from "../appDialog";
import { classifyLocalFeatures, extractLocalFeatures } from "../localThreatClassifier";
import {
  analyzePastedText,
  friendlyAnalysisError,
  normalizeFeatures,
} from "../messageAnalysis";
import { getToken } from "../../utils/storage";

const FEATURES = new Array(50).fill(3);

describe("message analysis helpers", () => {
  test("keeps a 50-value uint8 vector", () => {
    expect(normalizeFeatures(new Array(50).fill(3))).toHaveLength(50);
  });

  test("rounds numeric features into bytes", () => {
    const raw = new Array(50).fill(1.2);
    expect(normalizeFeatures(raw)[0]).toBe(1);
  });

  test("rejects a short vector", () => {
    expect(normalizeFeatures(new Array(12).fill(1))).toBeNull();
  });

  test("hides remote failures from the user", () => {
    expect(friendlyAnalysisError(new ApiError("http://10.0.2.2/api", 500))).toMatch(
      /téléphone|abouti|indisponible|impossible/i,
    );
    expect(friendlyAnalysisError(new Error("boom"))).toMatch(/téléphone|impossible|analyser/i);
  });

  test("never blames an expired session", () => {
    const message = friendlyAnalysisError(new ApiError("x", 401, null, true));
    expect(message).not.toMatch(/session/i);
    expect(message).toMatch(/indisponible|abouti/i);
  });
});

describe("analyzePastedText", () => {
  beforeEach(() => {
    getToken.mockReset();
    analyzeMessage.mockReset();
    analyzeFeatureVector.mockReset();
    showDialog.mockReset();
    showDialog.mockResolvedValue("local");
    extractLocalFeatures.mockReset();
    classifyLocalFeatures.mockReset();
  });

  test("sans session ni modèle local, la vérification demande un compte", async () => {
    getToken.mockResolvedValue(null);
    extractLocalFeatures.mockResolvedValue(null);

    const outcome = await analyzePastedText("un message franchement suspect");

    expect(outcome.requiresAuth).toBe(true);
    expect(outcome.error).toBeUndefined();
    // Aucun appel reseau : l'invite est posee avant le 401.
    expect(analyzeMessage).not.toHaveBeenCalled();
  });

  test("avec une session, l'analyse distante est tentée", async () => {
    getToken.mockResolvedValue("token");
    extractLocalFeatures.mockResolvedValue(null);

    const outcome = await analyzePastedText("un message franchement suspect");

    expect(outcome.requiresAuth).toBeUndefined();
  });

  test("un résultat local incertain reste disponible sans compte", async () => {
    getToken.mockResolvedValue(null);
    extractLocalFeatures.mockResolvedValue(FEATURES);
    classifyLocalFeatures.mockResolvedValue({ decision: "UNCERTAIN" });
    showDialog.mockResolvedValue("local");

    const outcome = await analyzePastedText("un message franchement suspect");

    expect(outcome.requiresAuth).toBeUndefined();
    expect(outcome.result).toBeTruthy();
    expect(analyzeFeatureVector).not.toHaveBeenCalled();
  });

  test("un résultat local incertain peut mener à l'invitation", async () => {
    getToken.mockResolvedValue(null);
    extractLocalFeatures.mockResolvedValue(FEATURES);
    classifyLocalFeatures.mockResolvedValue({ decision: "UNCERTAIN" });
    showDialog.mockResolvedValue("account");

    const outcome = await analyzePastedText("un message franchement suspect");

    expect(outcome.requiresAuth).toBe(true);
    expect(outcome.error).toBeUndefined();
  });

  test("une session refusée par le serveur remonte l'exigence de compte", async () => {
    getToken.mockResolvedValue("token-expire");
    extractLocalFeatures.mockResolvedValue(FEATURES);
    classifyLocalFeatures.mockResolvedValue({ decision: "UNCERTAIN" });
    showDialog.mockResolvedValue("remote");
    analyzeFeatureVector.mockRejectedValue(
      new ApiError("Votre session a expiré. Reconnectez-vous.", 401, null, true),
    );

    const outcome = await analyzePastedText("un message franchement suspect");

    expect(outcome.requiresAuth).toBe(true);
    expect(outcome.cause).toBeInstanceOf(ApiError);
  });
});
