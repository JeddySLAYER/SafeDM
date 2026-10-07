/** SafeDM API base (no trailing slash). Override via chrome.storage.local key `safedm_api_base`. */
export const DEFAULT_API_BASE = "https://safedm-backend.onrender.com/api/v1";

export const STORAGE_KEYS = {
  token: "safedm_access_token",
  username: "safedm_username",
  apiBase: "safedm_api_base",
};
