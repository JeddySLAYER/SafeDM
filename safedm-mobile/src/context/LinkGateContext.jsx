import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const LinkGateContext = createContext(null);

export function LinkGateProvider({ children }) {
  const [pendingUrl, setPendingUrl] = useState(null);

  const queueUrl = useCallback((url) => {
    const value = (url || "").trim();
    if (!value) return;
    setPendingUrl(value);
  }, []);

  const consumeUrl = useCallback(() => {
    const value = pendingUrl;
    setPendingUrl(null);
    return value;
  }, [pendingUrl]);

  const clearUrl = useCallback(() => setPendingUrl(null), []);

  const value = useMemo(
    () => ({ pendingUrl, queueUrl, consumeUrl, clearUrl }),
    [pendingUrl, queueUrl, consumeUrl, clearUrl],
  );

  return (
    <LinkGateContext.Provider value={value}>{children}</LinkGateContext.Provider>
  );
}

export function useLinkGate() {
  const ctx = useContext(LinkGateContext);
  if (!ctx) {
    throw new Error("useLinkGate must be used within LinkGateProvider");
  }
  return ctx;
}
