import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { ApiErrorEnvelope, ApiSuccess, PageMeta, Paginated } from '@/types/api';
import type { AuthData } from '@/types/domain';

const API_PREFIX = '/api/v1';
const ACCESS_TOKEN_KEY = 'fegih.access-token';
const REFRESH_TOKEN_KEY = 'fegih.refresh-token';

type AuthEvent = 'expired';
type AuthEventListener = (event: AuthEvent) => void;
const authEventListeners = new Set<AuthEventListener>();

export function notifyAuthEvent(event: AuthEvent): void {
  authEventListeners.forEach((listener) => listener(event));
}

export function subscribeToAuthEvents(listener: AuthEventListener): () => void {
  authEventListeners.add(listener);
  return () => authEventListeners.delete(listener);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function withApiPrefix(value: string): string {
  const normalized = stripTrailingSlash(value);
  return normalized.endsWith(API_PREFIX) ? normalized : `${normalized}${API_PREFIX}`;
}

/**
 * Expo Go/development builds expose the Metro host in hostUri. Replacing the
 * Metro port with 4000 is intentional: it makes a LAN API reachable from a
 * physical device without embedding a machine-specific address in the app.
 */
function getHostUri(): string | undefined {
  const expoConfig = Constants.expoConfig as
    | (typeof Constants.expoConfig & {
        hostUri?: string;
        extra?: Record<string, unknown>;
      })
    | null;
  const extra = expoConfig?.extra;
  const routerOrigin =
    extra && typeof extra.routerOrigin === 'string' ? extra.routerOrigin : undefined;
  return expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? routerOrigin;
}

export function getApiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (override) {
    return withApiPrefix(override);
  }

  /**
   * The web build is served from the same origin as its API proxy, so a
   * relative path is both correct and portable across preview URLs.
   *
   * The `hostUri` branch below exists for a phone talking to a development
   * machine, where the API really does listen on port 4000 of that machine. On
   * web the host is the deployment itself and there is no port 4000, so it
   * would produce `https://fegih.vercel.app:4000` and every call would fail.
   */
  if (Platform.OS === 'web') {
    return API_PREFIX;
  }

  const hostUri = getHostUri();
  if (hostUri) {
    const withoutScheme = hostUri.replace(/^(exp|exps|https?):\/\//i, '');
    const hostAndPort = (withoutScheme.split('/')[0] ?? '').trim();
    const host = hostAndPort.startsWith('[')
      ? hostAndPort.slice(0, hostAndPort.indexOf(']') + 1)
      : hostAndPort.split(':')[0];
    if (host) {
      return `http://${host}:4000${API_PREFIX}`;
    }
  }

  // Relative URLs are useful for web and for a same-origin reverse proxy.
  // Native builds should provide a LAN host through hostUri or the env override.
  return API_PREFIX;
}

export const apiBaseUrl = getApiBaseUrl();

const ADMIN_PORT = 3000;

/**
 * The admin panel is a separate Next.js app on port 3000. Deriving the host the
 * same way as the API keeps `localhost` and physical-device (LAN) setups working
 * without hard-coding a machine-specific address.
 */
export function getAdminBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_ADMIN_URL?.trim();
  if (override) return stripTrailingSlash(override);

  const hostUri = getHostUri();
  if (hostUri) {
    const withoutScheme = hostUri.replace(/^(exp|exps|https?):\/\//i, '');
    const hostAndPort = (withoutScheme.split('/')[0] ?? '').trim();
    const host = hostAndPort.startsWith('[')
      ? hostAndPort.slice(0, hostAndPort.indexOf(']') + 1)
      : hostAndPort.split(':')[0];
    if (host) return `http://${host}:${ADMIN_PORT}`;
  }
  return `http://localhost:${ADMIN_PORT}`;
}

/** Short request budget: a wrong host must fail fast instead of hanging. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Token storage.
 *
 * `expo-secure-store` has no web implementation — calling it throws
 * `UnavailabilityError`. On the deployed web build that made every sign-in
 * fail outright, because the tokens were saved before the request was sent and
 * the rejection aborted the whole flow. The web build therefore keeps the
 * tokens in `localStorage`; the native app keeps using the secure store.
 *
 * `localStorage` is not as protected as the keychain, but it is the only
 * storage a browser offers, and the token is short lived and scoped to this
 * origin.
 */
const webStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing or a full quota: the session simply is not persisted.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Best effort.
    }
  },
};

async function readToken(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webStorage.get(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeToken(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteToken(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.remove(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getAccessToken(): Promise<string | null> {
  return readToken(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return readToken(REFRESH_TOKEN_KEY);
}

export async function saveAuthTokens(tokens: Pick<AuthData, 'accessToken' | 'refreshToken'>): Promise<void> {
  await Promise.all([
    writeToken(ACCESS_TOKEN_KEY, tokens.accessToken),
    writeToken(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearAuthTokens(): Promise<void> {
  try {
    await Promise.all([
      deleteToken(ACCESS_TOKEN_KEY),
      deleteToken(REFRESH_TOKEN_KEY),
    ]);
  } catch {
    // Clearing is best effort; the in-memory auth state is cleared by callers.
  }
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Client-Platform': Platform.OS === 'web' ? 'web' : 'mobile',
  },
});

type RetriableRequest = InternalAxiosRequestConfig & { __fegihAuthRetry?: boolean };

let refreshPromise: Promise<string> | null = null;

function isRefreshRequest(config?: InternalAxiosRequestConfig): boolean {
  return config?.url?.includes('/auth/refresh') ?? false;
}

function isAuthEntryRequest(config?: InternalAxiosRequestConfig): boolean {
  return (
    config?.url?.includes('/auth/login') ??
    false
  ) || config?.url?.includes('/auth/register') === true;
}

apiClient.interceptors.request.use(async (config) => {
  if (isRefreshRequest(config) || isAuthEntryRequest(config)) {
    return config;
  }

  const token = await getAccessToken();
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token is available.');
  }

  // This client is intentionally separate from apiClient so a refresh failure
  // cannot recursively enter the response interceptor.
  const response = await axios.post<ApiSuccess<AuthData> | AuthData>(
    `${apiBaseUrl}/auth/refresh`,
    { refreshToken },
    { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
  );
  const body = response.data as ApiSuccess<AuthData> | AuthData;
  const data = 'data' in body ? body.data : body;
  if (!data.accessToken || !data.refreshToken) {
    throw new Error('The refresh response did not contain auth tokens.');
  }
  await saveAuthTokens(data);
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const originalRequest = error.config as RetriableRequest | undefined;
    const shouldRefresh =
      error.response?.status === 401 &&
      originalRequest !== undefined &&
      !originalRequest.__fegihAuthRetry &&
      !isRefreshRequest(originalRequest) &&
      !isAuthEntryRequest(originalRequest);

    if (!shouldRefresh || !originalRequest) {
      return Promise.reject(error);
    }

    originalRequest.__fegihAuthRetry = true;
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const accessToken = await refreshPromise;
      const headers = AxiosHeaders.from(originalRequest.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      originalRequest.headers = headers;
      return apiClient(originalRequest);
    } catch (refreshError) {
      await clearAuthTokens();
      notifyAuthEvent('expired');
      return Promise.reject(refreshError);
    }
  },
);

export async function unwrap<T>(response: Promise<{ data: ApiSuccess<T> | T }>): Promise<T> {
  const resolved = await response;
  const body = resolved.data;
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data;
  }
  return body as T;
}

/**
 * Paginated endpoints answer with `{ data, meta }`, but `unwrap` returns the
 * inner value. Screens therefore received a bare array while reading
 * `query.data.data` / `query.data.meta`, so every list (leaderboard, store,
 * missions, rewards, orders, notifications, tasbeeh, quiz bank) rendered
 * empty. This preserves the envelope instead.
 */
export async function unwrapPage<T>(response: Promise<{ data: unknown }>): Promise<Paginated<T>> {
  const resolved = await response;
  const body = resolved.data;
  if (Array.isArray(body)) {
    return { data: body as T[], meta: { page: 1, limit: body.length, total: body.length, totalPages: body.length ? 1 : 0 } };
  }
  const envelope = (body ?? {}) as { data?: T[]; meta?: PageMeta };
  const rows = envelope.data ?? [];
  const meta = envelope.meta ?? { page: 1, limit: rows.length, total: rows.length, totalPages: rows.length ? 1 : 0 };
  return { data: rows, meta };
}

/**
 * Absolute URL for an API endpoint, for use with `Linking.openURL` (certificate
 * print view, audio, …). On web the client uses a relative `/api/v1` base, so
 * the current origin has to be prepended.
 */
export function absoluteApiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (/^https?:\/\//i.test(apiBaseUrl)) return `${apiBaseUrl}${suffix}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${apiBaseUrl}${suffix}`;
  }
  return `${apiBaseUrl}${suffix}`;
}
