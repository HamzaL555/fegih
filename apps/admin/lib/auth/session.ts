import type { AuthSession } from "@/types/auth";

const SESSION_KEY = "fegih.admin.session.v1";
export const AUTH_FAILURE_EVENT = "fegih:auth-failure";

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as AuthSession;
    if (!session.accessToken || !session.user?.role) return null;
    return session;
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function notifyAuthFailure() {
  clearStoredSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_FAILURE_EVENT));
  }
}
