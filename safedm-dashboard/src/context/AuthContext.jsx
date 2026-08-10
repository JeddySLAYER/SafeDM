import { createContext, useContext, useMemo, useState } from "react";
import { getStoredUser, getToken } from "../services/api";
import * as adminApi from "../services/adminApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getToken());
  const [user, setUser] = useState(() => getStoredUser());

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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
