import { useCallback, useMemo, useState } from "react";
import { ToastContext } from "./toastContext";

let toastSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message, tone = "success") => {
      const id = ++toastSeq;
      setToasts((current) => [...current.slice(-4), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`} role="status">
            <span>{item.message}</span>
            <button type="button" className="toast-dismiss" onClick={() => dismiss(item.id)} aria-label="Fermer">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
