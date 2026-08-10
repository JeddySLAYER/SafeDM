import { apiRequest, clearSession, setSession } from "./api";

export async function login(username, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    auth: false,
    body: { username, password },
  });
  if (!data.user?.is_admin) {
    throw new Error("Accès réservé aux administrateurs.");
  }
  setSession(data.access_token, data.user);
  return data.user;
}

export function logout() {
  clearSession();
}

export function getStats() {
  return apiRequest("/admin/stats");
}

export function getThreats({ page = 1, pageSize = 20, status } = {}) {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status) q.set("status", status);
  return apiRequest(`/admin/threats?${q}`);
}

export function updateThreatStatus(id, status) {
  return apiRequest(`/admin/threats/${id}/status`, {
    method: "PUT",
    body: { status },
  });
}

export function getUsers({ page = 1, pageSize = 20 } = {}) {
  return apiRequest(`/admin/users?page=${page}&page_size=${pageSize}`);
}

export function getGuideCategories() {
  return apiRequest("/admin/guide/categories");
}

export function createCategory(payload) {
  return apiRequest("/admin/guide/categories", { method: "POST", body: payload });
}

export function createArticle(payload) {
  return apiRequest("/admin/guide/articles", { method: "POST", body: payload });
}

export function updateArticle(id, payload) {
  return apiRequest(`/admin/guide/articles/${id}`, { method: "PUT", body: payload });
}

export function deleteArticle(id) {
  return apiRequest(`/admin/guide/articles/${id}`, { method: "DELETE" });
}
