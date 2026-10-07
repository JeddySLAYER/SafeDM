import { STORAGE_KEYS } from "./config.js";

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result || {}));
  });
}

function storageSet(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

export async function getToken() {
  const data = await storageGet([STORAGE_KEYS.token]);
  return data[STORAGE_KEYS.token] || null;
}

export async function getUsername() {
  const data = await storageGet([STORAGE_KEYS.username]);
  return data[STORAGE_KEYS.username] || null;
}

export async function getApiBase() {
  const data = await storageGet([STORAGE_KEYS.apiBase]);
  return data[STORAGE_KEYS.apiBase] || null;
}

export async function setSession({ accessToken, username }) {
  const payload = {};
  if (accessToken != null) payload[STORAGE_KEYS.token] = accessToken;
  if (username != null) payload[STORAGE_KEYS.username] = username;
  await storageSet(payload);
}

export async function clearSession() {
  await storageRemove([STORAGE_KEYS.token, STORAGE_KEYS.username]);
}

export async function setApiBase(url) {
  if (!url) {
    await storageRemove([STORAGE_KEYS.apiBase]);
    return;
  }
  await storageSet({ [STORAGE_KEYS.apiBase]: url.replace(/\/+$/, "") });
}
