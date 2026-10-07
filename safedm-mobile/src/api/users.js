import { apiRequest } from "./client";

export function getMe() {
  return apiRequest("/users/me");
}

export function getMonitoring() {
  return apiRequest("/users/me/monitoring");
}

export function updateMonitoring(preferences) {
  return apiRequest("/users/me/monitoring", {
    method: "PUT",
    body: { preferences },
  });
}

export function registerDevice(deviceIdentifier) {
  return apiRequest("/users/me/devices", {
    method: "POST",
    body: { device_identifier: deviceIdentifier },
  });
}

export function listApplications() {
  return apiRequest("/applications", { auth: false });
}
