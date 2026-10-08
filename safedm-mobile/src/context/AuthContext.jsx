import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "../api/auth";
import { getLegalStatus } from "../api/legal";
import { signInWithFirebase } from "../services/firebaseAuth";
import * as usersApi from "../api/users";
import {
  clearSession,
  getOrCreateDeviceId,
  getStoredUser,
  getToken,
  isOnboardingDone,
  isSetupDone,
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

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [storedToken, storedUser, done, setup] = await Promise.all([
          getToken(),
          getStoredUser(),
          isOnboardingDone(),
          isSetupDone(),
        ]);
        if (cancelled) {
          return;
        }
        setOnboardingDoneState(done);
        setSetupDoneState(setup);
        if (!storedToken) {
          setTokenState(null);
          setUser(null);
          return;
        }
        setTokenState(storedToken);
        setUser(storedUser);
        let sessionOk = false;
        try {
          const me = await usersApi.getMe();
          sessionOk = true;
          if (!cancelled) {
            setUser(me);
            await setStoredUser(me);
          }
        } catch {
          await clearSession();
          if (!cancelled) {
            setTokenState(null);
            setUser(null);
          }
        }
        if (!cancelled && sessionOk) {
          try {
            const legal = await getLegalStatus();
            setPoliciesOk((legal.pending_slugs || []).length === 0);
          } catch {
            setPoliciesOk(false);
          }
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback(async (auth) => {
    await setToken(auth.access_token);
    await setStoredUser(auth.user);
    let accepted = false;
    try {
      const legal = await getLegalStatus();
      accepted = (legal.pending_slugs || []).length === 0;
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
  }, []);

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
    setPoliciesOk(false);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await persistOnboardingDone();
    setOnboardingDoneState(true);
  }, []);

  const completeSetup = useCallback(async () => {
    await persistSetupDone();
    setSetupDoneState(true);
  }, []);

  const completePolicies = useCallback(async () => {
    setPoliciesOk(true);
  }, []);

  const value = useMemo(
    () => ({
      bootstrapping,
      token,
      user,
      isAuthenticated: Boolean(token),
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
