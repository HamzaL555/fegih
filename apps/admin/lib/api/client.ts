"use client";

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "@/lib/env";
import { getStoredSession, notifyAuthFailure, storeSession } from "@/lib/auth/session";
import type { AuthSession, AuthUser } from "@/types/auth";
import { firstString, isRecord } from "@/lib/utils";

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { Accept: "application/json" }
});

export function unwrapData<T>(payload: unknown): T {
  if (isRecord(payload) && "data" in payload) return payload.data as T;
  return payload as T;
}

function normalizeAuthPayload(payload: unknown, fallbackUser?: AuthUser) {
  const root = unwrapData<unknown>(payload);
  if (!isRecord(root)) throw new Error("Auth cavabının formatı düzgün deyil");

  const tokenGroup = isRecord(root.tokens) ? root.tokens : root;
  const accessToken = firstString(
    tokenGroup.accessToken,
    tokenGroup.access_token,
    root.accessToken,
    root.access_token,
    root.token
  );
  if (!accessToken) throw new Error("Access token alınmadı");

  const rawUser = isRecord(root.user) ? root.user : isRecord(root.profile) ? root.profile : root;
  const email = firstString(rawUser.email) || fallbackUser?.email || "";
  const id = firstString(String(rawUser.id || ""), rawUser._id) || fallbackUser?.id || "";
  const fullName = firstString(
    rawUser.fullName,
    rawUser.full_name,
    rawUser.displayName,
    rawUser.name,
    [firstString(rawUser.firstName), firstString(rawUser.lastName)].filter(Boolean).join(" "),
    fallbackUser?.fullName
  ) || firstString(rawUser.username) || email;
  const roleValue = isRecord(rawUser.role) ? rawUser.role : isRecord(root.role) ? root.role : undefined;
  const role = firstString(
    typeof rawUser.role === "string" ? rawUser.role : undefined,
    typeof root.role === "string" ? root.role : undefined,
    roleValue?.name,
    roleValue?.code,
    fallbackUser?.role
  );
  if (!id || !role) throw new Error("İstifadəçi məlumatları və ya rol alınmadı");

  return {
    accessToken,
    refreshToken: firstString(
      tokenGroup.refreshToken,
      tokenGroup.refresh_token,
      root.refreshToken,
      root.refresh_token
    ) || null,
    user: {
      id,
      email,
      fullName,
      role,
      avatarUrl: firstString(rawUser.avatarUrl, rawUser.avatar_url, rawUser.profileImage) || null
    } satisfies AuthUser
  };
}

let refreshPromise: Promise<AuthSession> | null = null;

async function refreshSession() {
  const current = getStoredSession();
  if (!current?.refreshToken) throw new Error("Refresh token mövcud deyil");

  const response = await axios.post<unknown>(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken: current.refreshToken },
    { headers: { Accept: "application/json" }, timeout: 30_000 }
  );
  const next = normalizeAuthPayload(response.data, current.user);
  const session: AuthSession = {
    accessToken: next.accessToken,
    refreshToken: next.refreshToken || current.refreshToken,
    user: next.user
  };
  storeSession(session);
  return session;
}

apiClient.interceptors.request.use((config) => {
  const session = getStoredSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetryableRequest | undefined;
    const isAuthRoute = request?.url?.includes("/auth/login") || request?.url?.includes("/auth/refresh");

    if (error.response?.status !== 401 || !request || request._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      if (!refreshPromise) refreshPromise = refreshSession();
      const session = await refreshPromise;
      request.headers.Authorization = `Bearer ${session.accessToken}`;
      return await apiClient(request);
    } catch (refreshError) {
      notifyAuthFailure();
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  }
);
