import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/api-error.js';
import { createAccessToken } from '../../middleware/auth.js';

const hashToken = (token: string) => createHash('sha256').update(`${token}.${env.JWT_REFRESH_SECRET}`).digest('hex');

export const userWithRoles = {
  id: true,
  username: true,
  passwordHash: true,
  email: true,
  phone: true,
  displayName: true,
  avatarUrl: true,
  status: true,
  preferredLocale: true,
  timezone: true,
  points: true,
  level: true,
  xp: true,
  streak: true,
  longestStreak: true,
  totalGames: true,
  correctAnswers: true,
  wrongAnswers: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  roles: { select: { role: { select: { id: true, name: true, code: true } } } },
} as const;

type SelectedUser = {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  preferredLocale: string;
  timezone: string;
  points: number;
  level: number;
  xp: number;
  streak: number;
  longestStreak: number;
  totalGames: number;
  correctAnswers: number;
  wrongAnswers: number;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  roles: Array<{ role: { id: string; name: string; code: string } }>;
};

export function serializeUser(user: SelectedUser) {
  const roles = user.roles.map((item) => item.role);
  const primaryRole = roles[0] ?? null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    firstName: null,
    lastName: null,
    avatarUrl: user.avatarUrl,
    profileImage: user.avatarUrl,
    status: user.status,
    isBlocked: user.status === 'SUSPENDED',
    preferredLocale: user.preferredLocale,
    timezone: user.timezone,
    points: user.points,
    totalPoints: user.points,
    level: user.level,
    xp: user.xp,
    streak: user.streak,
    longestStreak: user.longestStreak,
    totalGames: user.totalGames,
    correctAnswers: user.correctAnswers,
    wrongAnswers: user.wrongAnswers,
    role: primaryRole,
    roles,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function issueTokenPair(user: { id: string; roles: Array<{ role: { name: string } }> }, request: Request) {
  const refreshToken = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: hashToken(refreshToken),
      expiresAt,
      userAgent: request.header('user-agent')?.slice(0, 1000),
      ipAddress: request.ip,
    },
  });
  return { accessToken: createAccessToken({ id: user.id, roles: user.roles.map((item) => item.role.name) }), refreshToken, expiresAt };
}

export async function rotateRefreshToken(refreshToken: string, request: Request) {
  const tokenHash = hashToken(refreshToken);
  return prisma.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      if (stored?.revokedAt) await tx.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw ApiError.unauthorized('Refresh token is invalid or expired');
    }
    const user = await tx.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, status: true, deletedAt: true, roles: { select: { role: { select: { name: true } } } } },
    });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') throw ApiError.unauthorized('This account is unavailable');

    const nextRefreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
    const next = await tx.refreshToken.create({
      data: {
        userId: user.id,
        familyId: stored.familyId,
        tokenHash: hashToken(nextRefreshToken),
        expiresAt,
        userAgent: request.header('user-agent')?.slice(0, 1000),
        ipAddress: request.ip,
      },
    });
    await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date(), replacedById: next.id } });
    return {
      accessToken: createAccessToken({ id: user.id, roles: user.roles.map((item) => item.role.name) }),
      refreshToken: nextRefreshToken,
      expiresAt,
    };
  });
}

export async function revokeRefreshToken(refreshToken: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export function calculateStreak(currentStreak: number, longestStreak: number, lastLoginAt: Date | null) {
  const now = new Date();
  if (!lastLoginAt) return { streak: 1, longestStreak: Math.max(longestStreak, 1) };
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const last = Date.UTC(lastLoginAt.getUTCFullYear(), lastLoginAt.getUTCMonth(), lastLoginAt.getUTCDate());
  const days = Math.round((today - last) / 86_400_000);
  if (days <= 0) return { streak: currentStreak, longestStreak };
  const streak = days === 1 ? currentStreak + 1 : 1;
  return { streak, longestStreak: Math.max(longestStreak, streak) };
}
