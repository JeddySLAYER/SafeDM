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

import { ApiError } from "../../api/client";
import {
  friendlyAnalysisError,
  normalizeFeatures,
} from "../messageAnalysis";

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
      /téléphone/,
    );
    expect(friendlyAnalysisError(new Error("boom"))).toMatch(/téléphone/);
  });
});
