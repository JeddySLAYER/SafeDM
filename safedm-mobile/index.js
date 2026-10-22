import QuickCrypto, { Buffer } from "react-native-quick-crypto";
import { registerRootComponent } from "expo";
import App from "./App";

// On installe `crypto` et `Buffer` a la main, SANS appeler `install()`.
//
// Pourquoi : `install()` de react-native-quick-crypto@1.1.7 ecrase
// `global.base64ToArrayBuffer` et `global.base64FromArrayBuffer` par des
// enveloppes qui appellent `react-native-quick-base64` — lequel rappelle a son
// tour ces memes globals. Or le projet epingle quick-base64 en 2.2.2 (la
// version 3 exige un runtime Nitro incompatible avec RN 0.76 ici) : cette 2.x
// lit et ecrit via les globals. La chaine est donc circulaire, et tout
// `Buffer.from(x, "base64")` ou `Buffer.toString("base64")` part en recursion
// infinie — `RangeError: Maximum call stack size exceeded`.
//
// Consequence concrete : l'enveloppe chiffree de l'empreinte (analyse distante
// du vecteur de features) et la verification du manifeste de modele echouaient
// systematiquement, sans message utile.
//
// On laisse donc les globals base64 natifs intacts. Le reste de `install()`
// (`global.crypto`, `global.Buffer`) est reproduit a l'identique.
global.crypto = QuickCrypto;
global.Buffer = Buffer;

registerRootComponent(App);
