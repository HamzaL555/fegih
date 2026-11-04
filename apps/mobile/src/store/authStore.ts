import { create } from 'zustand';

import { authApi, clearAuthTokens, getRefreshToken, saveAuthTokens, usersApi } from '@/api';
import { queryClient } from '@/api/queryClient';
import type { AuthCredentials, RegisterPayload, UserProfile } from '@/types/domain';
import { isNetworkError, isUnauthorized } from '@/utils/errors';

interface AuthState {
  user: UserProfile | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  shouldShowWelcome: boolean;
  hydrate: () => Promise<void>;
  login: (credentials: AuthCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  updateProfile: (payload: Partial<UserProfile>) => Promise<UserProfile>;
  deleteAccount: () => Promise<void>;
  clear: () => void;
  dismissWelcome: () => void;
}

function setAuthenticated(user: UserProfile) {
  return { user, status: 'authenticated' as const };
}

/** Never leave one account's cached data visible to the next one. */
function dropCachedData() {
  queryClient.clear();
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  shouldShowWelcome: false,

  hydrate: async () => {
    set({ status: 'loading' });
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      set({ status: 'unauthenticated', user: null });
      return;
    }

    try {
      const user = await usersApi.me();
      set(setAuthenticated(user));
    } catch (error) {
      // A transport failure (offline, server restarting, timeout) must NOT log
      // the user out: the refresh token is still valid and the previous
      // implementation deleted it, permanently ending the session.
      if (isUnauthorized(error)) {
        await clearAuthTokens();
        dropCachedData();
        set({ status: 'unauthenticated', user: null });
        return;
      }
      if (isNetworkError(error)) {
        // Tokens are intentionally kept: the session is still valid and the
        // next hydrate/login will pick it up once the server is reachable.
        set({ status: 'unauthenticated', user: null });
        return;
      }
      set({ status: 'unauthenticated', user: null });
    }
  },

  login: async (credentials) => {
    set({ status: 'loading', shouldShowWelcome: true });
    dropCachedData();
    try {
      const result = await authApi.login(credentials);
      await saveAuthTokens(result);
      const user = result.user ?? (await usersApi.me());
      set(setAuthenticated(user));
    } catch (error) {
      await clearAuthTokens();
      set({ status: 'unauthenticated', user: null, shouldShowWelcome: false });
      throw error;
    }
  },

  register: async (payload) => {
    set({ status: 'loading', shouldShowWelcome: true });
    dropCachedData();
    try {
      const result = await authApi.register(payload);
      await saveAuthTokens(result);
      const user = result.user ?? (await usersApi.me());
      set(setAuthenticated(user));
    } catch (error) {
      await clearAuthTokens();
      set({ status: 'unauthenticated', user: null, shouldShowWelcome: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      // The API only revokes a refresh token that is actually sent.
      await authApi.logout(await getRefreshToken());
    } catch {
      // Signing out locally must succeed even when the server is unreachable.
    } finally {
      await clearAuthTokens();
      dropCachedData();
      set({ status: 'unauthenticated', user: null, shouldShowWelcome: false });
    }
  },

  changePassword: async (payload) => {
    await authApi.changePassword(payload);
  },

  updateProfile: async (payload) => {
    const user = await usersApi.update(payload);
    set(setAuthenticated(user));
    queryClient.setQueryData(['users', 'me'], user);
    return user;
  },

  deleteAccount: async () => {
    try {
      await usersApi.remove();
    } finally {
      await clearAuthTokens();
      dropCachedData();
      set({ status: 'unauthenticated', user: null, shouldShowWelcome: false });
    }
  },

  clear: () => {
    dropCachedData();
    set({ status: 'unauthenticated', user: null, shouldShowWelcome: false });
  },

  dismissWelcome: () => set({ shouldShowWelcome: false }),
}));
