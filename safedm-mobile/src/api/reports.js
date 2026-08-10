import { apiRequest } from "./client";

export function listMyReports(activeOnly = true) {
  return apiRequest(`/reports?active_only=${activeOnly ? "true" : "false"}`);
}

export function createReport(payload) {
  return apiRequest("/reports", {
    method: "POST",
    body: {
      content: payload.content,
      source: payload.source || "MANUAL_ANALYSIS",
      severity: payload.severity || "MEDIUM",
      application_package: payload.application_package || null,
    },
  });
}

export function withdrawReport(reportId) {
  return apiRequest(`/reports/${reportId}`, { method: "DELETE" });
}
