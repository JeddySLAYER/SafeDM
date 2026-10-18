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

export function getStats(options) {
  return apiRequest("/admin/stats", options);
}

export function getOperationsOverview(options) {
  return apiRequest("/admin/operations/overview", options);
}

export function approvePatch(version, rolloutPercentage = 5) {
  return apiRequest("/admin/operations/patches/approve", {
    method: "POST",
    body: { version, rollout_percentage: Number(rolloutPercentage) },
  });
}

export function rollbackPatch(version) {
  return apiRequest("/admin/operations/patches/rollback", {
    method: "POST",
    body: { version },
  });
}

export function requestAggregation() {
  return apiRequest("/admin/operations/aggregation", { method: "POST" });
}

export function saveTenantPolicy(payload) {
  return apiRequest("/admin/operations/policies", { method: "PUT", body: payload });
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

export function flagThreatFalsePositive(id, value = true) {
  return apiRequest(`/admin/threats/${id}/false-positive`, {
    method: "PUT",
    body: { value },
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

export function getReport(id) {
  return apiRequest(`/admin/reports/${id}`);
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

export function listMlDatasets(options) {
  return apiRequest("/admin/ml/datasets", options);
}

export function getMlDataset(id) {
  return apiRequest(`/admin/ml/datasets/${id}`);
}

export function deleteMlDataset(id) {
  return apiRequest(`/admin/ml/datasets/${id}`, { method: "DELETE" });
}

export function createMlDataset(payload) {
  return apiRequest("/admin/ml/datasets", { method: "POST", body: payload });
}

export function createMlDatasetFromReports(payload) {
  return apiRequest("/admin/ml/datasets/from-reports", { method: "POST", body: payload });
}

export function listReportTrainingQueue() {
  return apiRequest("/admin/ml/report-review-queue");
}

export function reviewReportForTraining(id, expected) {
  return apiRequest(`/admin/ml/report-review-queue/${id}`, { method: "PUT", body: { expected } });
}

export function removeReportFromTrainingQueue(id) {
  return apiRequest(`/admin/ml/report-review-queue/${id}`, { method: "DELETE" });
}

export function createMlDatasetFromReviewQueue(name) {
  return apiRequest("/admin/ml/datasets/from-review-queue", { method: "POST", body: { name } });
}

export function seedBuiltinMlDataset() {
  return apiRequest("/admin/ml/datasets/seed-builtin", { method: "POST" });
}

export function listMlRuns(options) {
  return apiRequest("/admin/ml/runs", options);
}

export function getMlRun(id) {
  return apiRequest(`/admin/ml/runs/${id}`);
}

export function deleteMlRun(id) {
  return apiRequest(`/admin/ml/runs/${id}`, { method: "DELETE" });
}

export function startMlTrain(payload) {
  return apiRequest("/admin/ml/runs", { method: "POST", body: payload });
}

export function getLegalDocuments() {
  return apiRequest("/legal/documents");
}

export function updateLegalDocument(slug, payload) {
  return apiRequest(`/legal/documents/${slug}`, { method: "PUT", body: payload });
}

export function promoteMlRun(id) {
  return apiRequest(`/admin/ml/runs/${id}/promote`, { method: "POST" });
}

export function tryMlMessage({ message, run_id = null }) {
  return apiRequest("/admin/ml/try", {
    method: "POST",
    body: { message, run_id },
  });
}

export function evaluateMlTflite(dataset_id, run_id = null, mobile_features = null, mobile_results = null, mobile_messages = null, modelFile = null) {
  const evaluation = { dataset_id: Number(dataset_id), run_id: run_id ? Number(run_id) : null, mobile_features, mobile_results, mobile_messages };
  if (modelFile) {
    const body = new FormData();
    body.append("model_file", modelFile);
    body.append("payload", JSON.stringify(evaluation));
    return apiRequest("/admin/ml/evaluate-tflite-upload", { method: "POST", body });
  }

  return apiRequest("/admin/ml/evaluate-tflite", {
    method: "POST",
    body: evaluation,
  });
}

export function listMlArtifacts(options) {
  return apiRequest("/admin/ml/artifacts", options);
}

export function listMlEvaluations(artifactId) {
  const query = artifactId ? `?artifact_id=${Number(artifactId)}` : "";
  return apiRequest(`/admin/ml/evaluations${query}`);
}

export function getMlMetrics(artifactId) {
  return apiRequest(`/admin/ml/metrics?artifact_id=${Number(artifactId)}`);
}

export function getMlArtifact(id) {
  return apiRequest(`/admin/ml/artifacts/${id}`);
}

export function evaluateMlArtifact(id) {
  return apiRequest(`/admin/ml/artifacts/${id}/evaluate`, { method: "POST" });
}

export function reviewMlArtifact(id, status, note = null) {
  return apiRequest(`/admin/ml/artifacts/${id}/review`, {
    method: "PUT",
    body: { status, note },
  });
}

export function reviewMlRun(id, status, note = null) {
  return apiRequest(`/admin/ml/runs/${id}/review`, {
    method: "PUT",
    body: { status, note },
  });
}
