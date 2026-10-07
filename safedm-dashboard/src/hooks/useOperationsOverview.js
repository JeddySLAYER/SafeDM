import { useCallback } from "react";
import { getOperationsOverview } from "../services/adminApi";
import { useAsyncResource } from "./useAsyncResource";

export function useOperationsOverview() {
  const load = useCallback((signal) => getOperationsOverview({ signal }), []);
  return useAsyncResource(load, {
    cacheKey: "safedm_admin_operations_cache",
    cacheTtlMs: 30_000,
  });
}
