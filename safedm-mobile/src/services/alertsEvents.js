/** Bus léger pour rafraîchir Accueil / Alertes quand une alerte change. */
const listeners = new Set();

export function subscribeAlertsChanged(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAlertsChanged() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}
