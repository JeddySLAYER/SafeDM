/* eslint-env jest */

import {
  createModelInput,
  decideLocalThreat,
  FEATURE_COUNT,
  LOCAL_DECISION,
  tensorElementCount,
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
    const input = createModelInput(new Array(FEATURE_COUNT).fill(7));
    expect(input[0]).toBe(7);
    expect(input).toHaveLength(FEATURE_COUNT);
  });

  test("returns a TypedArray, never a bare ArrayBuffer", () => {
    // Le binding natif exige ArrayBuffer.isView(input). Un ArrayBuffer brut
    // fait echouer TypedArrayBase::getBuffer() en C++ : l'exception traverse
    // la frontiere JSI et termine le process en build release.
    const input = createModelInput(new Array(FEATURE_COUNT).fill(1));

    expect(ArrayBuffer.isView(input)).toBe(true);
    expect(input).not.toBeInstanceOf(ArrayBuffer);
    expect(input).toBeInstanceOf(Float32Array);
    // 50 float32 = 200 octets, exactement la taille du tenseur [1, 50].
    expect(input.byteLength).toBe(FEATURE_COUNT * 4);
    expect(input.buffer.byteLength).toBe(FEATURE_COUNT * 4);
  });

  test("honours the data type declared by the input tensor", () => {
    const input = createModelInput(new Array(FEATURE_COUNT).fill(3), {
      dataType: "uint8",
      shape: [1, FEATURE_COUNT],
    });

    expect(input).toBeInstanceOf(Uint8Array);
    expect(input).toHaveLength(FEATURE_COUNT);
  });

  test("rejects a feature vector that does not match the tensor shape", () => {
    expect(() =>
      createModelInput(new Array(FEATURE_COUNT).fill(0), {
        dataType: "float32",
        shape: [1, FEATURE_COUNT + 1],
      }),
    ).toThrow("attend 51");
  });

  test("rejects values outside the range of the declared integer type", () => {
    expect(() =>
      createModelInput(new Array(FEATURE_COUNT).fill(200), {
        dataType: "int8",
        shape: [1, FEATURE_COUNT],
      }),
    ).toThrow("hors bornes");
  });

  test("ignores a tensor with a dynamic dimension", () => {
    expect(tensorElementCount({ shape: [1, -1] })).toBeNull();
    expect(tensorElementCount(null)).toBeNull();

    const input = createModelInput(new Array(FEATURE_COUNT).fill(2), {
      shape: [1, -1],
    });
    expect(input).toHaveLength(FEATURE_COUNT);
  });
});
