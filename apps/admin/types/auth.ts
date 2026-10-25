export type UserRole = "ADMIN" | "SUPER_ADMIN" | (string & {});

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string | null;
  user: AuthUser;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface RefreshCredentials {
  refreshToken: string;
}
