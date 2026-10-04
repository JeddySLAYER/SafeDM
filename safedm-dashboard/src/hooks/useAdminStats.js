import { useCallback } from "react";
import { getStats } from "../services/adminApi";
import { useAsyncResource } from "./useAsyncResource";

export function useAdminStats() {
  const load = useCallback((signal) => getStats({ signal }), []);
  return useAsyncResource(load, {
    cacheKey: "safedm_admin_stats_cache",
    cacheTtlMs: 20_000,
  });
}
