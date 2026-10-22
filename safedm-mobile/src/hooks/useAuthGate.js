import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

/**
 * Garde d'authentification pour un ecran qui, parfois, exige un compte.
 *
 * Deux cas distincts :
 *
 * - l'ecran est utilisable sans compte (l'alerte locale, le resultat d'une
 *   analyse) : seule l'action « signaler » est reservee ;
 * - l'ecran est inutile sans compte (la liste de mes signalements, la
 *   communaute) : toute la page est remplacee par l'invitation.
 *
 * `capture` a appeler dans le `catch` d'un appel API : il renvoie `true` quand
 * l'echec vient d'une session manquante, pour basculer sur l'invitation au
 * lieu d'afficher une erreur sans issue.
 */
export default function useAuthGate() {
  const { isAuthenticated } = useAuth();
  const [blocked, setBlocked] = useState(false);
  // L'utilisateur a-t-il eu une session sur cet ecran ? C'est ce qui
  // distingue « session expiree » de « jamais connecte » — et donc
  // « Se connecter » de « Creer un compte » dans l'invitation.
  const hadSession = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      hadSession.current = true;
    }
  }, [isAuthenticated]);

  const capture = useCallback((err) => {
    if (err instanceof ApiError && (err.requiresAuth || err.status === 401)) {
      if (hadSession.current) {
        setBlocked(true);
      }
      return true;
    }
    return false;
  }, []);

  return {
    isAuthenticated,
    /** La session a-t-elle ete refusee par le serveur pendant l'ecran ? */
    blocked,
    /** Faut-il afficher l'invitation a se connecter ? */
    requiresAuth: blocked || !isAuthenticated,
    /**
     * Quelle action mettre en avant dans l'invitation.
     *
     * Un visiteur qui n'a jamais eu de compte doit trouver « creer un compte »
     * en premier ; quelqu'un dont la session a expire doit trouver « se
     * connecter » — son compte existe deja.
     */
    prefer: blocked ? "login" : "register",
    capture,
  };
}
