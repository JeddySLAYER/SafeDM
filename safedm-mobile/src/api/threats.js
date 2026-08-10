import { apiRequest } from "./client";

export function listCommunityThreats(page = 1, pageSize = 20) {
  return apiRequest(`/threats/community?page=${page}&page_size=${pageSize}`);
}
