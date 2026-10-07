import { useCallback, useEffect, useRef, useState } from "react";

function readCache(cacheKey, maxAgeMs) {
  if (!cacheKey || typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (!cached?.data || Date.now() - cached.at > maxAgeMs) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCache(cacheKey, data) {
  if (!cacheKey || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // A full or disabled sessionStorage must not break the dashboard.
  }
}

export function useAsyncResource(
  load,
  { cacheKey, cacheTtlMs = 30_000, immediate = true } = {},
) {
  const initialCache = useRef(readCache(cacheKey, cacheTtlMs)).current;
  const [data, setData] = useState(initialCache?.data ?? null);
  const [updatedAt, setUpdatedAt] = useState(initialCache?.at ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(immediate && !initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef(null);
  const hasDataRef = useRef(Boolean(initialCache?.data));

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading((current) => current && !hasDataRef.current);
    setRefreshing(true);
    setError("");
    try {
      const result = await load(controller.signal);
      setData(result);
      hasDataRef.current = true;
      setUpdatedAt(Date.now());
      writeCache(cacheKey, result);
      return result;
    } catch (err) {
      if (err.name === "AbortError") return null;
      setError(err.message || "Erreur de chargement");
      throw err;
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [cacheKey, load]);

  useEffect(() => {
    if (immediate) refresh().catch(() => {});
    return () => requestRef.current?.abort();
  }, [immediate, refresh]);

  return { data, error, loading, refreshing, updatedAt, refresh };
}
