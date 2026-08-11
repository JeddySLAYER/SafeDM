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

export function getThreat(id) {
  return apiRequest(`/admin/threats/${id}`);
}

export function updateThreatStatus(id, status) {
  return apiRequest(`/admin/threats/${id}/status`, {
    method: "PUT",
    body: { status },
  });
}

export function updateThreatSeverity(id, severity) {
  return apiRequest(`/admin/threats/${id}/severity`, {
    method: "PUT",
    body: { severity },
  });
}

export function getReports({ page = 1, pageSize = 20, status } = {}) {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status) q.set("status", status);
  return apiRequest(`/admin/reports?${q}`);
}

export function withdrawReport(id) {
  return apiRequest(`/admin/reports/${id}`, { method: "DELETE" });
}

export function getUsers({ page = 1, pageSize = 20 } = {}) {
  return apiRequest(`/admin/users?page=${page}&page_size=${pageSize}`);
}

export function getUser(id) {
  return apiRequest(`/admin/users/${id}`);
}

export function updateUser(id, payload) {
  return apiRequest(`/admin/users/${id}`, { method: "PUT", body: payload });
}

export function getApplications() {
  return apiRequest("/admin/applications");
}

export function createApplication(payload) {
  return apiRequest("/admin/applications", { method: "POST", body: payload });
}

export function updateApplication(id, payload) {
  return apiRequest(`/admin/applications/${id}`, { method: "PUT", body: payload });
}

export function deleteApplication(id) {
  return apiRequest(`/admin/applications/${id}`, { method: "DELETE" });
}

export function getLinkGateEvents({ page = 1, pageSize = 20, decision } = {}) {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (decision) q.set("decision", decision);
  return apiRequest(`/admin/link-gate?${q}`);
}

export function getGuideCategories() {
  return apiRequest("/admin/guide/categories");
}

export function getArticle(id) {
  return apiRequest(`/admin/guide/articles/${id}`);
}

export function createCategory(payload) {
  return apiRequest("/admin/guide/categories", { method: "POST", body: payload });
}

export function updateCategory(id, payload) {
  return apiRequest(`/admin/guide/categories/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteCategory(id) {
  return apiRequest(`/admin/guide/categories/${id}`, { method: "DELETE" });
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
