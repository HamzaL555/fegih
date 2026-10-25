import axios from "axios";
import { API_BASE_URL } from "@/lib/env";
import type { AuthSession, LoginCredentials } from "@/types/auth";
import { firstString, isRecord } from "@/lib/utils";

function normalizeLogin(payload: unknown): AuthSession {
  const root = isRecord(payload) && "data" in payload ? payload.data : payload;
  if (!isRecord(root)) throw new Error("Giriş cavabının formatı düzgün deyil");

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
  const id = firstString(String(rawUser.id || ""), rawUser._id);
  const email = firstString(rawUser.email) || "";
  const fullName = firstString(
    rawUser.fullName,
    rawUser.full_name,
    rawUser.displayName,
    rawUser.name,
    [firstString(rawUser.firstName), firstString(rawUser.lastName)].filter(Boolean).join(" ")
  ) || firstString(rawUser.username) || email;
  const roleValue = isRecord(rawUser.role) ? rawUser.role : isRecord(root.role) ? root.role : undefined;
  const role = firstString(
    typeof rawUser.role === "string" ? rawUser.role : undefined,
    typeof root.role === "string" ? root.role : undefined,
    roleValue?.name,
    roleValue?.code
  );
  if (!id || !role) throw new Error("İstifadəçi rolu alınmadı");

  return {
    accessToken,
    refreshToken: firstString(
      tokenGroup.refreshToken,
      tokenGroup.refresh_token,
      root.refreshToken,
      root.refresh_token
    ) || null,
    user: { id, email, fullName, role, avatarUrl: firstString(rawUser.avatarUrl, rawUser.avatar_url, rawUser.profileImage) || null }
  };
}

export async function login(credentials: LoginCredentials) {
  const response = await axios.post<unknown>(`${API_BASE_URL}/auth/login`, credentials, {
    headers: { Accept: "application/json" },
    timeout: 30_000
  });
  return normalizeLogin(response.data);
}

export async function logout(refreshToken?: string | null) {
  await axios.post(`${API_BASE_URL}/auth/logout`, refreshToken ? { refreshToken } : {}, {
    headers: { Accept: "application/json" },
    timeout: 30_000
  });
}
