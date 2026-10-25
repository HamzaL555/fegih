import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  type: 'access';
  roles: string[];
}

interface AuthUser {
  id: string;
  status: string;
  roles: string[];
}

/**
 * Every authenticated request used to re-read the user + roles from Postgres.
 * The result is cached for 60s, which keeps a burst of parallel mobile calls
 * to a single query while still picking up suspensions within a minute.
 */
const USER_CACHE_TTL_MS = 60_000;
const MAX_USER_CACHE_ENTRIES = 5_000;
const userCache = new Map<string, { user: AuthUser; expiresAt: number }>();

export function invalidateAuthUserCache(userId?: string): void {
  if (userId) {
    userCache.delete(userId);
    return;
  }
  userCache.clear();
}

async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, deletedAt: true, roles: { select: { role: { select: { name: true } } } } },
  });
  if (!user || user.deletedAt || user.status !== 'ACTIVE') {
    userCache.set(userId, { user: { id: userId, status: user?.status ?? 'UNKNOWN', roles: [] }, expiresAt: Date.now() + 5_000 });
    return null;
  }

  const authUser: AuthUser = { id: user.id, status: user.status, roles: user.roles.map((item) => item.role.name) };
  if (userCache.size >= MAX_USER_CACHE_ENTRIES) userCache.clear();
  userCache.set(userId, { user: authUser, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  return authUser;
}

export function createAccessToken(user: { id: string; roles: string[] }) {
  return jwt.sign(
    { type: 'access', roles: user.roles },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
      issuer: 'fegih-api',
      audience: 'fegih-mobile-admin',
      jwtid: crypto.randomUUID(),
    },
  );
}

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return next(ApiError.unauthorized());

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(authorization.slice(7), env.JWT_SECRET, {
      issuer: 'fegih-api',
      audience: 'fegih-mobile-admin',
    }) as AccessTokenPayload;
  } catch {
    return next(ApiError.unauthorized('Access token is invalid or expired'));
  }
  if (payload.type !== 'access' || !payload.sub) return next(ApiError.unauthorized('Access token is invalid or expired'));

  try {
    const user = await loadAuthUser(payload.sub);
    if (!user) return next(ApiError.unauthorized('This account is unavailable'));
    request.user = { id: user.id, status: user.status, roles: user.roles };
    next();
  } catch {
    next(ApiError.unauthorized('Access token is invalid or expired'));
  }
}

export function optionalAuth(request: Request, response: Response, next: NextFunction) {
  if (!request.header('authorization')) return next();
  return requireAuth(request, response, next);
}
