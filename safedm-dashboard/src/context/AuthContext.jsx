import { useEffect, useMemo, useState } from "react";
import { getStoredUser, getToken, LOGOUT_EVENT } from "../services/api";
import * as adminApi from "../services/adminApi";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getToken());
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onLogout = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener(LOGOUT_EVENT, onLogout);
    const onStorage = (event) => {
      if (event.key === "safedm_admin_token" && event.newValue === null) {
        setToken(null);
        setUser(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LOGOUT_EVENT, onLogout);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user?.is_admin),
      async login(username, password) {
        const u = await adminApi.login(username, password);
        setToken(getToken());
        setUser(u);
        return u;
      },
      logout() {
        adminApi.logout();
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
