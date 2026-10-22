import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "../api/auth";
import { ApiError } from "../api/client";
import { acceptLegalDocuments, getLegalStatus, listLegalDocuments } from "../api/legal";
import { signInWithFirebase } from "../services/firebaseAuth";
import { subscribeSessionExpired } from "../services/sessionEvents";
import * as usersApi from "../api/users";
import {
  clearSession,
  getAcceptedPolicies,
  getOrCreateDeviceId,
  getStoredUser,
  getToken,
  isOnboardingDone,
  isSetupDone,
  setAcceptedPolicies,
  setOnboardingDone as persistOnboardingDone,
  setSetupDone as persistSetupDone,
  setStoredUser,
  setToken,
} from "../utils/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [onboardingDone, setOnboardingDoneState] = useState(false);
  const [setupDone, setSetupDoneState] = useState(false);
  const [policiesOk, setPoliciesOk] = useState(false);

  /**
   * Rejoue cote serveur une acceptance deja donnee hors ligne.
   *
   * L'API /legal/accept exige un jeton : sans compte, l'acceptation reste
   * locale. Des qu'un compte existe, on enregistre l'acceptation pour que le
   * dossier de l'utilisateur soit complet — mais uniquement pour les
   * versions que la personne a reellement lues : si la politique a change
   * depuis, l'ecran d'acceptation est reaffiche.
   */
  const syncServerAcceptance = useCallback(async (status) => {
    const pending = status?.pending_slugs || [];
    if (!pending.length) return true;
    const local = await getAcceptedPolicies();
    const docs = status?.documents || [];
    const covered = pending
      .map((slug) => docs.find((doc) => doc.slug === slug))
      .filter((doc) => doc && local[doc.slug] === doc.version);
    if (!covered.length) return false;
    try {
      await acceptLegalDocuments(
        covered.map((doc) => ({ slug: doc.slug, version: doc.version })),
      );
    } catch {
      return false;
    }
    try {
      // Le serveur peut avoir une version plus recente que celle acceptee
      // hors ligne : dans ce cas l'utilisateur doit relire la politique.
      const after = await getLegalStatus();
      return (after.pending_slugs || []).length === 0;
    } catch {
      // L'acceptation est passee ; on ne bloque pas l'utilisateur.
      return true;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    /**
     * Demarrage : uniquement des lectures locales.
     *
     * L'application doit s'afficher sans attendre le reseau. Toute validation
     * distante est repoussee en tache de fond (voir `validateSession`), sinon
     * un serveur lent suffisait a faire attendre l'utilisateur sur le splash.
     */
    async function bootstrap() {
      try {
        const [storedToken, storedUser, done, setup, accepted] =
          await Promise.all([
            getToken(),
            getStoredUser(),
            isOnboardingDone(),
            isSetupDone(),
            getAcceptedPolicies(),
          ]);
        if (cancelled) {
          return;
        }
        setOnboardingDoneState(done);
        setSetupDoneState(setup);
        setTokenState(storedToken);
        setUser(storedUser);
        // L'acceptation locale suffit pour demarrer. La comparaison avec la
        // version publiee se fait en arriere-plan (voir `validateSession`).
        setPoliciesOk(Object.keys(accepted || {}).length > 0);
        setBootstrapping(false);

        validateSession(storedToken);
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    /**
     * Verification serveur, en arriere-plan.
     *
     * - Sans session : on compare l'acceptation locale a la version publiee.
     * - Avec session : on verifie que le jeton est encore valide, puis que
     *   les documents ont bien ete acceptes cote serveur.
     */
    async function validateSession(storedToken) {
      if (cancelled) return;
      try {
        if (!storedToken) {
          const local = await getAcceptedPolicies();
          if (!Object.keys(local).length) {
            setPoliciesOk(false);
            return;
          }
          try {
            const docs = await listLegalDocuments();
            if (cancelled) return;
            const outdated = (docs || []).some(
              (doc) => local[doc.slug] !== doc.version,
            );
            setPoliciesOk(!outdated);
          } catch {
            // Hors ligne : l'accord local reste valable.
            setPoliciesOk(true);
          }
          return;
        }

        let sessionOk = false;
        try {
          const me = await usersApi.getMe();
          sessionOk = true;
          if (!cancelled) {
            setUser(me);
            await setStoredUser(me);
          }
        } catch (err) {
          // Un coup de réseau au démarrage ne doit pas déconnecter : seul un
          // vrai refus du serveur (401) invalide le jeton stocké.
          if (err instanceof ApiError && err.status === 401) {
            await clearSession();
            if (!cancelled) {
              setTokenState(null);
              setUser(null);
            }
            return;
          }
        }
        if (!cancelled && sessionOk) {
          try {
            const legal = await getLegalStatus();
            if (cancelled) return;
            setPoliciesOk(await syncServerAcceptance(legal));
          } catch {
            if (!cancelled) setPoliciesOk(false);
          }
        }
      } catch {
        /* la session locale reste valable */
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Session invalidee par le serveur (401).
   *
   * L'interface repasse en mode invite : les ecrans qui exigent un compte
   * (signalements, suivi des accords) proposent de se connecter au lieu
   * d'afficher une impasse.
   */
  useEffect(
    () =>
      subscribeSessionExpired(() => {
        setTokenState(null);
        setUser(null);
      }),
    [],
  );

  const applySession = useCallback(
    async (auth) => {
      await setToken(auth.access_token);
      await setStoredUser(auth.user);
      let accepted = false;
      try {
        const legal = await getLegalStatus();
        accepted = await syncServerAcceptance(legal);
      } catch {
        accepted = false;
      }
      setPoliciesOk(accepted);
      setTokenState(auth.access_token);
      setUser(auth.user);
      try {
        const deviceId = await getOrCreateDeviceId();
        await usersApi.registerDevice(deviceId);
      } catch {
        // Device registration is best-effort.
      }
    },
    [syncServerAcceptance],
  );

  const login = useCallback(
    async (username, password) => {
      const auth = await authApi.login(username, password);
      await applySession(auth);
      return auth.user;
    },
    [applySession],
  );

  const loginFirebase = useCallback(
    async (email, password) => {
      const idToken = await signInWithFirebase(email, password);
      const auth = await authApi.loginWithFirebaseToken(idToken);
      await applySession(auth);
      return auth.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (username, password) => {
      const auth = await authApi.register(username, password);
      await applySession(auth);
      return auth.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await clearSession();
    setTokenState(null);
    setUser(null);
    // L'acceptation des documents reste valable sur cet appareil : on ne
    // rebloque pas l'utilisateur invite juste apres une deconnexion.
    const local = await getAcceptedPolicies();
    if (!Object.keys(local).length) {
      setPoliciesOk(false);
      return;
    }
    try {
      const docs = await listLegalDocuments();
      const outdated = (docs || []).some(
        (doc) => local[doc.slug] !== doc.version,
      );
      setPoliciesOk(!outdated);
    } catch {
      setPoliciesOk(true);
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    await persistOnboardingDone();
    setOnboardingDoneState(true);
  }, []);

  const completeSetup = useCallback(async () => {
    await persistSetupDone();
    setSetupDoneState(true);
  }, []);

  /**
   * Enregistre l'acceptation des documents.
   *
   * `documents` : la liste reellement lue a l'ecran. Elle est memorisee
   * localement avec sa version, ce qui permet de la rejouer cote serveur
   * si un compte est cree plus tard.
   */
  const completePolicies = useCallback(async (documents = []) => {
    const map = {};
    documents.forEach((doc) => {
      if (doc?.slug) map[doc.slug] = doc.version ?? 1;
    });
    if (Object.keys(map).length) {
      await setAcceptedPolicies(map);
    }
    setPoliciesOk(true);
  }, []);

  const value = useMemo(
    () => ({
      bootstrapping,
      token,
      user,
      isAuthenticated: Boolean(token),
      isGuest: !token,
      onboardingDone,
      setupDone,
      needsSetup: Boolean(token) && !setupDone,
      policiesOk,
      login,
      loginFirebase,
      register,
      logout,
      completeOnboarding,
      completeSetup,
      completePolicies,
      allowGuest: true,
    }),
    [
      bootstrapping,
      token,
      user,
      onboardingDone,
      setupDone,
      policiesOk,
      login,
      loginFirebase,
      register,
      logout,
      completeOnboarding,
      completeSetup,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
