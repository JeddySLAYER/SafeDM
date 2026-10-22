/* eslint-env jest */

import { base64ToBytes, bytesToBase64 } from "../base64";

describe("encodage Base64 sans Buffer", () => {
  test("produit la meme sortie que Buffer", () => {
    const inputs = [
      new Uint8Array([]),
      new Uint8Array([0]),
      new Uint8Array([1, 2, 3]),
      new Uint8Array([1, 2, 3, 4]),
      new Uint8Array([1, 2, 3, 4, 5]),
      new Uint8Array([255, 254, 253, 252, 251, 250]),
      new Uint8Array([251, 255, 190]),
      new Uint8Array(Array.from({ length: 256 }, (_, i) => i)),
    ];
    for (const input of inputs) {
      expect(bytesToBase64(input)).toBe(Buffer.from(input).toString("base64"));
    }
  });

  test("fait l'aller-retour", () => {
    const input = new Uint8Array([0, 127, 128, 255, 42, 99]);
    expect(Array.from(base64ToBytes(bytesToBase64(input)))).toEqual(Array.from(input));
  });

  test("decode une chaine Base64 standard", () => {
    expect(Array.from(base64ToBytes("aGVsbG8="))).toEqual([104, 101, 108, 108, 111]);
    expect(Array.from(base64ToBytes("YQ=="))).toEqual([97]);
    expect(Array.from(base64ToBytes("YWI="))).toEqual([97, 98]);
    expect(Array.from(base64ToBytes("YWJj"))).toEqual([97, 98, 99]);
  });

  test("tolere l'URL-safe et le padding absent", () => {
    const standard = bytesToBase64(new Uint8Array([251, 255, 190]));
    expect(standard).toBe("+/++");
    expect(Array.from(base64ToBytes("-_--"))).toEqual([251, 255, 190]);
    expect(Array.from(base64ToBytes("aGVsbG8"))).toEqual([104, 101, 108, 108, 111]);
  });

  test("ignore les caracteres hors alphabet", () => {
    expect(Array.from(base64ToBytes("aGVs\nbG8="))).toEqual([104, 101, 108, 108, 111]);
  });

  test("une chaine vide donne un tableau vide", () => {
    expect(base64ToBytes("").length).toBe(0);
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
  });
});
