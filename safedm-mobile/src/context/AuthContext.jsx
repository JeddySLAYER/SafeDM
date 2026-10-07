import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "../api/auth";
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
        try {
          const me = await usersApi.getMe();
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
  }, []);

  const completeOnboarding = useCallback(async () => {
    await persistOnboardingDone();
    setOnboardingDoneState(true);
  }, []);

  const completeSetup = useCallback(async () => {
    await persistSetupDone();
    setSetupDoneState(true);
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
      login,
      register,
      logout,
      completeOnboarding,
      completeSetup,
    }),
    [
      bootstrapping,
      token,
      user,
      onboardingDone,
      setupDone,
      login,
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
