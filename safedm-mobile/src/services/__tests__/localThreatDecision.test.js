/* eslint-env jest */

import {
  createModelInput,
  decideLocalThreat,
  FEATURE_COUNT,
  LOCAL_DECISION,
} from "../localThreatDecision";

describe("local threat decision", () => {
  test.each([
    [0.2, LOCAL_DECISION.SAFE],
    [0.4, LOCAL_DECISION.UNCERTAIN],
    [0.849, LOCAL_DECISION.UNCERTAIN],
    [0.85, LOCAL_DECISION.DANGEROUS],
  ])("routes %s to %s", (probability, decision) => {
    expect(decideLocalThreat(probability).decision).toBe(decision);
  });

  test("rejects a tensor with the wrong shape", () => {
    expect(() => createModelInput(new Array(FEATURE_COUNT - 1).fill(0))).toThrow(
      "attend 50",
    );
  });

  test("creates a float32 tensor from the uint8 vector", () => {
    const buffer = createModelInput(new Array(FEATURE_COUNT).fill(7));
    expect(new Float32Array(buffer)[0]).toBe(7);
    expect(new Float32Array(buffer)).toHaveLength(FEATURE_COUNT);
  });
});
