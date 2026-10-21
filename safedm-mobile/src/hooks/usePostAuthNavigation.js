import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Redirige l'utilisateur apres une connexion ou une inscription.
 *
 * - l'acceptation des documents reste a faire -> ecran "Politiques" ;
 * - sinon -> permissions (premier lancement) ou accueil.
 *
 * La session peut expirer entre deux lancements : le hook attend donc
 * l'etat authentifie au lieu de se fier au retour de `login()`.
 */
export default function usePostAuthNavigation(navigation) {
  const { isAuthenticated, policiesOk, needsSetup } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    navigation.reset({
      index: 0,
      routes: [
        !policiesOk
          ? { name: "Policies" }
          : needsSetup
            ? { name: "Permissions", params: { onboarding: true } }
            : { name: "MainTabs" },
      ],
    });
  }, [isAuthenticated, policiesOk, needsSetup, navigation]);
}
