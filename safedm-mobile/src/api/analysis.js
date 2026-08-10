import { apiRequest } from "./client";

export function analyzeMessage(payload) {
  return apiRequest("/analysis", {
    method: "POST",
    body: {
      content: payload.content,
      source: payload.source || "MANUAL",
      application_package: payload.application_package || null,
      title: payload.title || null,
      sender: payload.sender || null,
    },
  });
}
