import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { serializeUser, userWithRoles } from '../auth/service.js';

const updateProfileSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ.-]+$/u).optional(),
  displayName: z.string().trim().min(2).max(120).optional(),
  profileImage: z.string().url().max(2048).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  preferredLocale: z.enum(['az', 'tr', 'en', 'ar']).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.user!.id }, select: userWithRoles });
  if (!user) throw ApiError.notFound('User not found');
  const favorites = await prisma.wishlistItem.findMany({ where: { userId: request.user!.id }, orderBy: { createdAt: 'desc' }, select: { bookId: true } });
  response.json({ data: { ...serializeUser(user), favorites } });
});

usersRouter.patch('/me', writeLimiter, async (request, response) => {
  const input = parse(updateProfileSchema, request.body);
  if (input.username) {
    const duplicate = await prisma.user.findFirst({ where: { username: { equals: input.username, mode: 'insensitive' }, id: { not: request.user!.id } }, select: { id: true } });
    if (duplicate) throw ApiError.conflict('Bu username artıq istifadə olunur', { field: 'username' });
  }
  const { profileImage, ...rest } = input;
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: request.user!.id },
      data: { ...rest, ...(profileImage !== undefined ? { avatarUrl: profileImage } : {}) },
      select: userWithRoles,
    });
    if (rest.preferredLocale) await tx.userPreference.upsert({ where: { userId: updated.id }, update: { language: rest.preferredLocale }, create: { userId: updated.id, language: rest.preferredLocale } });
    return updated;
  });
  response.json({ data: serializeUser(user) });
});

usersRouter.delete('/me', writeLimiter, async (request, response) => {
  const id = request.user!.id;
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { status: 'DELETED', deletedAt: new Date(), email: null, phone: null, username: `deleted_${id.slice(0, 20)}` } }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  response.status(204).send();
});
