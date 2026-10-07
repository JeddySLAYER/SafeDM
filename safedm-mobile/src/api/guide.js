import { apiRequest } from "./client";

export function listCategories() {
  return apiRequest("/guide/categories", { auth: false });
}

export function getArticle(articleId) {
  return apiRequest(`/guide/articles/${articleId}`, { auth: false });
}
