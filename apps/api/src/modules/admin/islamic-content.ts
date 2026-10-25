import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const auth = [requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR')] as const;
const ayahSchema = z.object({ day: z.coerce.date(), surahNumber: z.number().int().positive(), ayahNumber: z.number().int().positive(), reference: z.string().min(1).max(40), arabicText: z.string().min(1), translationText: z.string().min(1), transliteration: z.string().nullable().optional(), audioUrl: z.string().url().nullable().optional(), sourceUrl: z.string().url().nullable().optional() });
const infoSchema = z.object({ day: z.coerce.date(), title: z.string().min(1).max(250), summary: z.string().nullable().optional(), content: z.string().min(1), imageUrl: z.string().url().nullable().optional(), isPublished: z.boolean().default(false), publishedAt: z.coerce.date().nullable().optional() });
const eventSchema = z.object({ slug: z.string().min(1).max(180), title: z.string().min(1).max(250), description: z.string().nullable().optional(), startsAt: z.coerce.date(), endsAt: z.coerce.date().nullable().optional(), allDay: z.boolean().default(false), hijriDate: z.string().max(80).nullable().optional(), location: z.string().max(250).nullable().optional(), venue: z.string().max(250).nullable().optional(), imageUrl: z.string().url().nullable().optional(), registrationUrl: z.string().url().nullable().optional(), isPublished: z.boolean().default(false) });

export const adminAyahRouter = Router(); adminAyahRouter.use(...auth);
adminAyahRouter.get('/', async (request, response) => { const { page, limit, skip } = getPagination(request); const [data, total] = await prisma.$transaction([prisma.dailyAyah.findMany({ orderBy: { day: 'desc' }, skip, take: limit }), prisma.dailyAyah.count()]); response.json({ data, meta: paginationMeta(page, limit, total) }); });
adminAyahRouter.post('/', writeLimiter, async (request, response) => response.status(201).json({ data: await prisma.dailyAyah.create({ data: parse(ayahSchema, request.body) }) }));
adminAyahRouter.patch('/:id', writeLimiter, async (request, response) => response.json({ data: await prisma.dailyAyah.update({ where: { id: z.string().cuid().parse(request.params.id) }, data: parse(ayahSchema.partial(), request.body) }) }));
adminAyahRouter.delete('/:id', writeLimiter, async (request, response) => { await prisma.dailyAyah.delete({ where: { id: z.string().cuid().parse(request.params.id) } }); response.status(204).send(); });

export const adminInfoRouter = Router(); adminInfoRouter.use(...auth);
adminInfoRouter.get('/', async (request, response) => { const { page, limit, skip } = getPagination(request); const [data, total] = await prisma.$transaction([prisma.dailyInfo.findMany({ orderBy: { day: 'desc' }, skip, take: limit }), prisma.dailyInfo.count()]); response.json({ data, meta: paginationMeta(page, limit, total) }); });
adminInfoRouter.post('/', writeLimiter, async (request, response) => response.status(201).json({ data: await prisma.dailyInfo.create({ data: parse(infoSchema, request.body) }) }));
adminInfoRouter.patch('/:id', writeLimiter, async (request, response) => response.json({ data: await prisma.dailyInfo.update({ where: { id: z.string().cuid().parse(request.params.id) }, data: parse(infoSchema.partial(), request.body) }) }));
adminInfoRouter.delete('/:id', writeLimiter, async (request, response) => { await prisma.dailyInfo.delete({ where: { id: z.string().cuid().parse(request.params.id) } }); response.status(204).send(); });

export const adminEventsRouter = Router(); adminEventsRouter.use(...auth);
adminEventsRouter.get('/', async (request, response) => { const { page, limit, skip } = getPagination(request); const [data, total] = await prisma.$transaction([prisma.islamicEvent.findMany({ orderBy: { startsAt: 'asc' }, skip, take: limit }), prisma.islamicEvent.count()]); response.json({ data, meta: paginationMeta(page, limit, total) }); });
adminEventsRouter.post('/', writeLimiter, async (request, response) => response.status(201).json({ data: await prisma.islamicEvent.create({ data: parse(eventSchema, request.body) }) }));
adminEventsRouter.patch('/:id', writeLimiter, async (request, response) => response.json({ data: await prisma.islamicEvent.update({ where: { id: z.string().cuid().parse(request.params.id) }, data: parse(eventSchema.partial(), request.body) }) }));
adminEventsRouter.delete('/:id', writeLimiter, async (request, response) => { await prisma.islamicEvent.delete({ where: { id: z.string().cuid().parse(request.params.id) } }); response.status(204).send(); });
