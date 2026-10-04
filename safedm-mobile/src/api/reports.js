import { apiRequest } from "./client";
import { encryptFingerprintPayload } from "../services/fingerprintEnvelope";

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

export function createFingerprintReport(payload) {
  return encryptFingerprintPayload({
    similarity_hash: payload.similarityHash,
    source: payload.source || "NOTIFICATION",
    severity: payload.severity || "MEDIUM",
    observed_at: payload.observedAt || null,
    application_package: payload.applicationPackage || null,
  }).then((envelope) => apiRequest("/reports/fingerprint/envelope", {
    method: "POST",
    body: envelope,
  }));
}

export function withdrawReport(reportId) {
  return apiRequest(`/reports/${reportId}`, { method: "DELETE" });
}
