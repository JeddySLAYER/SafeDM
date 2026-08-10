import { apiRequest } from "./client";

export function register(username, password) {
  return apiRequest("/auth/register", {
    method: "POST",
    auth: false,
    body: { username, password },
  });
}

export function login(username, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    auth: false,
    body: { username, password },
  });
}
