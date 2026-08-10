/**
 * Configuration runtime SafeDM Mobile (Expo).
 * API_BASE_URL via app.config.js → extra, surchargeable par process.env au prebuild.
 */
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

/** Émulateur Android → 10.0.2.2 ; device physique → IP LAN du PC */
export const API_BASE_URL =
  extra.apiBaseUrl || "http://10.0.2.2:8000/api/v1";

export const APP_VERSION = extra.appVersion || "1.0.0";
