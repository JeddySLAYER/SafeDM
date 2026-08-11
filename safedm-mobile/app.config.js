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

module.exports = {
  expo: {
    name: "SafeDM",
    slug: "safedm-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./src/assets/simplify-logo.png",
    scheme: "safedm",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.safedmmobile",
    },
    android: {
      package: "com.safedmmobile",
      adaptiveIcon: {
        foregroundImage: "./src/assets/simplify-logo.png",
        backgroundColor: "#000000",
      },
      permissions: ["INTERNET"],
      // SafeDM comme filtre de liens (navigateur / partage)
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
      "expo-dev-client",
      "expo-asset",
      "expo-font",
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: true,
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
      appVersion: "1.0.0",
    },
  },
};
