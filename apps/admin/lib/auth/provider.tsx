"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as loginRequest, logout as logoutRequest } from "@/lib/api/auth";
import { AUTH_FAILURE_EVENT, clearStoredSession, getStoredSession, storeSession } from "@/lib/auth/session";
import type { AuthSession, LoginCredentials } from "@/types/auth";

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function isAdminRole(role?: string | null) {
  const normalized = role?.trim().toUpperCase();
  return Boolean(normalized && ["SUPER_ADMIN", "ADMIN", "EDITOR", "ORDER_MANAGER", "QUESTION_MANAGER"].includes(normalized));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getStoredSession());
    setIsLoading(false);

    const onFailure = () => setSession(null);
    window.addEventListener(AUTH_FAILURE_EVENT, onFailure);
    return () => window.removeEventListener(AUTH_FAILURE_EVENT, onFailure);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const nextSession = await loginRequest(credentials);
    storeSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getStoredSession()?.refreshToken;
    clearStoredSession();
    setSession(null);
    try {
      await logoutRequest(refreshToken);
    } catch {
      // Local logout must still succeed if the network or API is unavailable.
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isLoading,
    isAdmin: isAdminRole(session?.user.role),
    login,
    logout
  }), [isLoading, login, logout, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth yalnız AuthProvider daxilində istifadə olunmalıdır");
  return context;
}
