import { apiRequest } from "./client";

export function listLegalDocuments() {
  return apiRequest("/legal/documents", { auth: false });
}

export function getLegalStatus() {
  return apiRequest("/legal/status");
}

export function acceptLegalDocuments(documents) {
  return apiRequest("/legal/accept", {
    method: "POST",
    body: { documents },
  });
}
