/**
 * Configuration runtime SafeDM Mobile.
 * Valeurs injectées depuis `.env` via react-native-dotenv (@env).
 */
import { API_BASE_URL as ENV_API_BASE_URL } from "@env";

/** Émulateur Android → 10.0.2.2 ; device physique → IP LAN du PC */
export const API_BASE_URL =
  ENV_API_BASE_URL || "http://10.0.2.2:8000/api/v1";

export const APP_VERSION = "1.0.0";
