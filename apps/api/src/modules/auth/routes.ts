import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { getSystemSetting } from '../../lib/settings-cache.js';
import { parse } from '../../lib/zod.js';
import { requireAuth, invalidateAuthUserCache } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { sendPasswordResetEmail } from './mailer.js';
import { calculateStreak, issueTokenPair, revokeRefreshToken, rotateRefreshToken, serializeUser, userWithRoles } from './service.js';

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const phoneSchema = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/);
const usernameSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ.-]+$/u);
const passwordSchema = z.string().min(8).max(128).regex(/[A-Za-zƏəİıÖöÜüĞğŞşÇç]/u, 'Parolda ən azı bir hərf olmalıdır');
/** bcrypt cost used for new hashes. 10 is the widely deployed baseline and is ~4x faster than 12 in pure-JS bcryptjs. */
const PASSWORD_ROUNDS = 10;
/**
 * Comparing against a throwaway hash keeps "unknown account" and "wrong
 * password" responses equally slow, which removes the user-enumeration timing
 * side channel.
 */
const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const registerSchema = z.object({
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  username: usernameSchema,
  displayName: z.string().trim().min(2).max(120).optional(),
  password: passwordSchema,
  confirmPassword: z.string(),
  preferredLocale: z.enum(['az', 'tr', 'en', 'ar']).optional(),
}).superRefine((data, context) => {
  if (!data.email && !data.phone) context.addIssue({ code: 'custom', path: ['email'], message: 'Email və ya telefon tələb olunur' });
  if (data.password !== data.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Parollar uyğun gəlmir' });
});
const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(320).optional(),
  emailOrPhone: z.string().trim().min(3).max(320).optional(),
  username: z.string().trim().min(3).max(32).optional(),
  password: z.string().min(1).max(128),
}).refine((data) => data.identifier || data.emailOrPhone || data.username, { message: 'Login məlumatı tələb olunur' });
const refreshSchema = z.object({ refreshToken: z.string().min(32) });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema, confirmPassword: z.string().optional() });
const forgotPasswordSchema = z.object({ email: emailSchema });
const resetPasswordSchema = z.object({ token: z.string().min(32), password: passwordSchema, confirmPassword: z.string().optional() });

async function settingValue<T>(key: string, fallback: T): Promise<T> {
  const value = await getSystemSetting<T>(key);
  return value ?? fallback;
}

export const authRouter = Router();
authRouter.use(authLimiter);

authRouter.post('/register', async (request, response) => {
  const input = parse(registerSchema, request.body);
  const registration = await settingValue<boolean | { enabled?: boolean }>('registrationEnabled', true);
  if ((typeof registration === 'boolean' ? registration : registration.enabled) === false) throw ApiError.forbidden('Qeydiyyat müvəqqəti bağlıdır');
  const email = input.email || undefined;
  const phone = input.phone || undefined;
  const duplicate = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
        ...(phone ? [{ phone }] : []),
        { username: { equals: input.username, mode: 'insensitive' as const } },
      ],
    },
    select: { email: true, phone: true, username: true },
  });
  if (duplicate) {
    const field = email && duplicate.email?.toLowerCase() === email ? 'email' : phone && duplicate.phone === phone ? 'phone' : 'username';
    throw ApiError.conflict(`${field} artıq istifadə olunur`, { field });
  }
  const role = await prisma.role.findUnique({ where: { name: 'USER' } });
  if (!role) throw new ApiError(500, 'SETUP_REQUIRED', 'Default user role has not been seeded');
  const [passwordHash, welcome] = await Promise.all([
    hash(input.password, PASSWORD_ROUNDS),
    settingValue<{ points?: number; lifelineType?: 'FIFTY_FIFTY'; lifelineQuantity?: number }>('welcomeBonus', { points: 0, lifelineQuantity: 0 }),
  ]);
  const startingPoints = Math.max(0, Math.trunc(welcome.points ?? 0));
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: input.username,
        displayName: input.displayName || input.username,
        email: email ?? null,
        phone: phone ?? null,
        passwordHash,
        preferredLocale: input.preferredLocale ?? 'az',
        points: startingPoints,
        streak: 1,
        longestStreak: 1,
        lastLoginAt: new Date(),
        roles: { create: { role: { connect: { id: role.id } } } },
        preference: { create: { language: input.preferredLocale ?? 'az' } },
      },
      select: userWithRoles,
    });
    if (startingPoints > 0) {
      await tx.pointLedgerEntry.create({ data: { userId: created.id, type: 'WELCOME_BONUS', amount: startingPoints, balanceAfter: startingPoints, sourceType: 'REGISTRATION', sourceId: created.id, idempotencyKey: `welcome:${created.id}`, description: 'Welcome bonus' } });
    }
    if (welcome.lifelineType && (welcome.lifelineQuantity ?? 0) > 0) {
      await tx.userLifelineInventory.create({ data: { userId: created.id, type: welcome.lifelineType, quantity: welcome.lifelineQuantity } });
    }
    return created;
  });
  const tokens = await issueTokenPair(user, request);
  response.status(201).json({ data: { user: serializeUser(user), ...tokens } });
});

authRouter.post('/login', async (request, response) => {
  const input = parse(loginSchema, request.body);
  const identifier = input.identifier || input.emailOrPhone || input.username!;
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { email: { equals: identifier, mode: 'insensitive' } },
        { phone: identifier },
        { username: { equals: identifier, mode: 'insensitive' } },
      ],
    },
    select: userWithRoles,
  });
  // `||` short-circuits, so a missing user would skip the hash comparison
  // entirely and answer measurably faster (a user-enumeration oracle). Always
  // run `compare`, against a throwaway hash when the account does not exist.
  const passwordMatches = await compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) throw ApiError.unauthorized('Giriş məlumatları düzgün deyil');
  if (user.status === 'SUSPENDED') throw ApiError.forbidden('Bu hesab bloklanıb');
  if (user.status !== 'ACTIVE') throw ApiError.forbidden('Bu hesab aktiv deyil');
  const streak = calculateStreak(user.streak, user.longestStreak, user.lastLoginAt);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), ...streak }, select: userWithRoles });
  const tokens = await issueTokenPair(updated, request);
  response.json({ data: { user: serializeUser(updated), ...tokens } });
});

authRouter.post('/refresh', async (request, response) => response.json({ data: await rotateRefreshToken(parse(refreshSchema, request.body).refreshToken, request) }));

authRouter.post('/logout', async (request, response) => {
  const parsed = refreshSchema.safeParse(request.body);
  if (parsed.success) await revokeRefreshToken(parsed.data.refreshToken);
  response.status(204).send();
});

authRouter.post('/change-password', requireAuth, async (request, response) => {
  const input = parse(changePasswordSchema, request.body);
  if (input.confirmPassword && input.newPassword !== input.confirmPassword) throw ApiError.badRequest('Parollar uyğun gəlmir');
  const user = await prisma.user.findUnique({ where: { id: request.user!.id }, select: { passwordHash: true } });
  if (!user || !await compare(input.currentPassword, user.passwordHash)) throw ApiError.badRequest('Cari parol düzgün deyil');
  const passwordHash = await hash(input.newPassword, PASSWORD_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: request.user!.id }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: request.user!.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  invalidateAuthUserCache(request.user!.id);
  response.status(204).send();
});

authRouter.post('/forgot-password', async (request, response) => {
  const { email } = parse(forgotPasswordSchema, request.body);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  let developmentResetToken: string | undefined;
  if (user?.email && user.id) {
    const token = randomBytes(32).toString('base64url');
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 30 * 60_000), ipAddress: request.ip, userAgent: request.header('user-agent') } }),
    ]);
    const delivery = await sendPasswordResetEmail(user.email, token);
    if (!delivery.delivered && env.ALLOW_DEV_RESET_TOKEN) {
      // Opt-in only: exposing the token makes any non-production, non-loopback
      // deployment a full account-takeover path.
      request.log?.warn({ userId: user.id }, 'Password reset token returned in the response body because ALLOW_DEV_RESET_TOKEN is enabled');
      developmentResetToken = token;
    }
  }
  response.json({ data: { message: 'Əgər bu email qeydə varsa, parol yeniləmə mesajı göndərildi' }, developmentResetToken });
});

authRouter.post('/reset-password', async (request, response) => {
  const input = parse(resetPasswordSchema, request.body);
  if (input.confirmPassword && input.password !== input.confirmPassword) throw ApiError.badRequest('Parollar uyğun gəlmir');
  const tokenHash = createHash('sha256').update(input.token).digest('hex');
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw ApiError.badRequest('Yeniləmə tokeni etibarsızdır və ya vaxtı bitib');
  const passwordHash = await hash(input.password, PASSWORD_ROUNDS);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  invalidateAuthUserCache(reset.userId);
  response.status(204).send();
});
