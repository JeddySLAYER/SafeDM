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
    version: process.env.APP_VERSION || "1.1.2",
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
      versionCode: Number(process.env.ANDROID_VERSION_CODE || 1),
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
      appVersion: process.env.APP_VERSION || "1.1.2",
      appEnv: isProduction ? "production" : "development",
      localModelUri: process.env.LOCAL_MODEL_URI || null,
      fingerprintPublicKey: process.env.FINGERPRINT_PUBLIC_KEY || null,
      modelManifestPublicKey: process.env.MODEL_MANIFEST_PUBLIC_KEY || null,
      eas: {
        projectId: "bc025d6a-0110-4c6c-9ef9-e2a1c3d9a2b2",
      },
    },
  },
};
