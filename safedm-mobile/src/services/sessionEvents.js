/**
 * Bus leger pour le deconnexion serveur.
 *
 * Quand l'API renvoie 401, la session locale est purgee. L'interface doit
 * alors basculer en mode invite : sans cet evenement, les ecrans restaient
 * bloques sur « votre session a expire » alors qu'un simple rechargement ne
 * resolvait rien.
 */
const listeners = new Set();

export function subscribeSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionExpired() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}
