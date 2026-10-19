import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const UpdateStatusContext = createContext(null);

export function UpdateStatusProvider({ children }) {
  const [status, setStatusState] = useState({
    state: "idle",
    message: "",
    visible: false,
    lastChecked: 0,
  });

  const setStatus = useCallback((next) => {
    setStatusState((prev) => ({
      ...prev,
      ...next,
      lastChecked: Date.now(),
    }));
  }, []);

  const clear = useCallback(() => {
    setStatusState({ state: "idle", message: "", visible: false, lastChecked: Date.now() });
  }, []);

  const startPatching = useCallback((message = "Mise à jour en cours...") => {
    setStatus({ state: "patching", message, visible: true });
  }, [setStatus]);

  const startUpdating = useCallback((message = "Mise à jour en cours...") => {
    setStatus({ state: "updating", message, visible: true });
  }, [setStatus]);

  const setCanaryActive = useCallback((message = "Version test active") => {
    setStatus({ state: "canary_active", message, visible: true });
  }, [setStatus]);

  const markReady = useCallback((message = "Mise à jour appliquée") => {
    setStatus({ state: "ready", message, visible: true });
    setTimeout(clear, 5000);
  }, [setStatus, clear]);

  const markError = useCallback((message = "Mise à jour interrompue. Réessayer.") => {
    setStatus({ state: "error", message, visible: true });
  }, [setStatus]);

  const value = useMemo(
    () => ({
      status,
      setStatus,
      clear,
      startPatching,
      startUpdating,
      setCanaryActive,
      markReady,
      markError,
    }),
    [status, setStatus, clear, startPatching, startUpdating, setCanaryActive, markReady, markError],
  );

  return (
    <UpdateStatusContext.Provider value={value}>
      {children}
    </UpdateStatusContext.Provider>
  );
}

export function useUpdateStatus() {
  const ctx = useContext(UpdateStatusContext);
  if (!ctx) {
    throw new Error("useUpdateStatus must be used within UpdateStatusProvider");
  }
  return ctx;
}
