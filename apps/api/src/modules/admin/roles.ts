import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

export const adminRolesRouter = Router();
adminRolesRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN'));
adminRolesRouter.get('/', async (_request, response) => response.json({ data: await prisma.role.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true, permissions: true } } } }) }));
adminRolesRouter.patch('/:roleId', writeLimiter, async (request, response) => { const roleId = z.string().cuid().parse(request.params.roleId); const input = parse(z.object({ name: z.string().trim().min(2).max(80).optional(), description: z.string().max(500).nullable().optional() }), request.body); response.json({ data: await prisma.role.update({ where: { id: roleId }, data: input }) }); });
