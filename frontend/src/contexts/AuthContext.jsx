import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  setAccessToken,
  setOnUnauthorized,
} from "../api/client";
import { authApi } from "../api/endpoints";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading"); // loading | authenticated | anonymous
  const [user, setUser] = useState(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => clearSession());
    return () => setOnUnauthorized(() => {});
  }, [clearSession]);

  const bootstrap = useCallback(async () => {
    try {
      await refreshSession();
      const me = await authApi.me();
      setUser(me);
      setStatus("authenticated");
    } catch {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    setUser(data.user);
    setStatus("authenticated");
    return data;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: status === "authenticated",
      role: user?.role || null,
      login,
      logout,
      refresh: bootstrap,
    }),
    [status, user, login, logout, bootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
