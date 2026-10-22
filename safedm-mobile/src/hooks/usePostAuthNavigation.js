import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Redirige l'utilisateur apres une connexion ou une inscription.
 *
 * - retour a l'ecran d'origine : l'utilisateur a ete envoye ici depuis un
 *   ecran qui attendait une session (signalements, guide, lien a verifier) ;
 *   le remettre au debut de l'application l'enverrait ailleurs et lui ferait
 *   perdre le contexte de son action ;
 * - sinon -> policies (premier lancement), permissions ou accueil.
 *
 * La session peut expirer entre deux lancements : le hook attend donc
 * l'etat authentifie au lieu de se fier au retour de `login()`.
 */
export default function usePostAuthNavigation(navigation) {
  const { isAuthenticated, policiesOk, needsSetup } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
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
