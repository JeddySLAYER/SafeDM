/* eslint-env jest */

const fs = require("fs");
const path = require("path");

/**
 * Garde-fou sur l'initialisation de `react-native-quick-crypto`.
 *
 * Le symptome (recursion infinie sur toute conversion Base64) n'est
 * observable que sur un appareil, ou le module natif `QuickBase64` installe
 * reellement `global.base64ToArrayBuffer`. Sous Jest, ce module natif est
 * absent : le bug se manifeste par une autre erreur, ou pas du tout. Ce test
 * verifie donc la source plutot que le comportement.
 */
describe("initialisation de react-native-quick-crypto", () => {
  const raw = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
  // On ne teste que le code : les commentaires expliquent le piege et
  // mentionnent `install()`.
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  test("n'appelle pas install(), qui recree la recursion base64", () => {
    expect(source).not.toMatch(/\binstall\s*\(/);
  });

  test("installe crypto et Buffer manuellement", () => {
    expect(source).toMatch(/global\.crypto\s*=/);
    expect(source).toMatch(/global\.Buffer\s*=/);
  });

  test("ne touche pas aux globals base64 natifs", () => {
    expect(source).not.toMatch(/global(This)?\.base64(To|From)ArrayBuffer\s*=/);
  });
});
