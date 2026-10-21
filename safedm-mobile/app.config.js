/**
 * Expo config — SafeDM Mobile
 * Dev client requis pour le module natif NotificationListenerService.
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const pkg = require("./package.json");

/**
 * Version / versionCode — source de verite unique : `package.json`.
 *
 * Les variables d'environnement du runner GitHub Actions ne sont PAS
 * transmises a un build EAS distant : seul `eas.json` (env statique) ou les
 * EAS environment variables le sont. Lire `package.json` garantit donc que
 * l'APK publie porte reellement la version annoncee, et que le versionCode
 * est incremente a chaque build (sinon Android refuse la mise a jour).
 */
const APP_VERSION = process.env.APP_VERSION || pkg.version;

/**
 * versionCode derive de la version semantique (1.2.3 -> 10203).
 *
 * Un versionCode doit strictement augmenter, sinon Android refuse la mise a
 * jour d'une version deja installee. Le derive de la version est monotone
 * et reproductible : deux builds de la meme version donnent le meme code.
 */
function versionCodeFromVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version || ""));
  if (!match) return null;
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
}

const ANDROID_VERSION_CODE = Number(
  process.env.ANDROID_VERSION_CODE ||
    pkg.buildNumber ||
    versionCodeFromVersion(APP_VERSION) ||
    1,
);

/**
 * Cle publique ECDSA P-256 (point non compresse, hex) qui verifie les
 * patchs OTA du modele.
 *
 * Elle est PUBLIQUE : l'appli l embarque pour verifier la signature du
 * manifeste qu'elle telecharge. Sans elle, `verifyPatchManifest` echoue et le
 * telephone garde silencieusement le modele embarque — les mises a jour OTA
 * ne sont jamais appliquees.
 *
 * Elle DOIT etre le pendant de `ML_PATCH_SIGNING_PRIVATE_KEY_PEM_B64` cote
 * backend. Rotation = nouvel APK + nouveau manifeste.
 */
const DEFAULT_MODEL_PATCH_PUBLIC_KEY_HEX =
  "042fbe37b5c3a1a19f4c04b7b2709694677feefd97be41b76b5b83f582c00f4e45ca176ace4f9d4acb234a753692e2a04122d2181fd6f4aabc91d697569e051f68";

const MODEL_PATCH_PUBLIC_KEY_HEX =
  process.env.MODEL_PATCH_PUBLIC_KEY_HEX || DEFAULT_MODEL_PATCH_PUBLIC_KEY_HEX;

const API_BASE_URL = (
  process.env.API_BASE_URL || "http://10.0.2.2:8000/api/v1"
).replace(/\/+$/, "");

// Release: APP_ENV=production or EAS profile production/apk
const isProduction =
  process.env.APP_ENV === "production" ||
  process.env.EAS_BUILD_PROFILE === "production" ||
  process.env.EAS_BUILD_PROFILE === "apk";

// Cleartext only for local/dev emulators — never in release APKs.
const allowCleartext = !isProduction;

module.exports = {
  expo: {
    name: "SafeDM",
    slug: "safedm-mobile",
    version: APP_VERSION,
    orientation: "portrait",
    icon: "./src/assets/icon.png",
    scheme: "safedm",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    splash: {
      image: "./src/assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#FFFFFF",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.safedmmobile",
    },
    android: {
      package: "com.safedmmobile",
      versionCode: ANDROID_VERSION_CODE,
      adaptiveIcon: {
        foregroundImage: "./src/assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
      splash: {
        image: "./src/assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
      },
      permissions: ["INTERNET", "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"],
      intentFilters: [
        {
          action: "VIEW",
          category: ["BROWSABLE", "DEFAULT", "APP_BROWSER"],
          data: [{ scheme: "https" }, { scheme: "http" }],
        },
        {
          action: "SEND",
          category: ["DEFAULT"],
          data: [{ mimeType: "text/plain" }],
        },
        {
          action: "VIEW",
          category: ["BROWSABLE", "DEFAULT"],
          data: [{ scheme: "safedm", host: "link", pathPrefix: "/" }],
        },
      ],
    },
    plugins: [
      ...(isProduction ? [] : ["expo-dev-client"]),
      "expo-asset",
      "expo-font",
      "expo-secure-store",
      "expo-splash-screen",
      "react-native-fast-tflite",
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: allowCleartext,
            minSdkVersion: 24,
            compileSdkVersion: 35,
            targetSdkVersion: 34,
          },
        },
      ],
      "./plugins/withSafeDMNotifications",
    ],
    extra: {
      apiBaseUrl: API_BASE_URL,
      appVersion: APP_VERSION,
      appEnv: isProduction ? "production" : "development",
      localModelUri: process.env.LOCAL_MODEL_URI || null,
      fingerprintPublicKey: process.env.FINGERPRINT_PUBLIC_KEY || null,
      modelManifestPublicKey: process.env.MODEL_MANIFEST_PUBLIC_KEY || null,
      modelPatchPublicKeyHex: MODEL_PATCH_PUBLIC_KEY_HEX,
      eas: {
        projectId: "bc025d6a-0110-4c6c-9ef9-e2a1c3d9a2b2",
      },
    },
  },
};
