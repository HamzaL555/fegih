import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { appendMessage, countUnread, createThread, getThread, listThreads } from './service.js';

const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(5000),
});
const replySchema = z.object({ body: z.string().trim().min(1).max(5000) });

/** The user's own inbox: ask a question, read the admin's answer, reply. */
export const messagesRouter = Router();
messagesRouter.use(requireAuth);

messagesRouter.get('/', async (request, response) => {
  const [threads, unread] = await Promise.all([listThreads(request.user!.id), countUnread(request.user!.id)]);
  response.json({ data: { threads, unreadCount: unread._sum.unreadByUser ?? 0 } });
});

messagesRouter.post('/', writeLimiter, async (request, response) => {
  const input = parse(createSchema, request.body);
  response.status(201).json({ data: await createThread(request.user!.id, input.subject, input.body) });
});

messagesRouter.get('/unread-count', async (request, response) => {
  const unread = await countUnread(request.user!.id);
  response.json({ data: { unreadCount: unread._sum.unreadByUser ?? 0 } });
});

messagesRouter.get('/:threadId', async (request, response) => {
  const threadId = z.string().cuid().parse(request.params.threadId);
  response.json({ data: await getThread(request.user!.id, threadId) });
});

messagesRouter.post('/:threadId/reply', writeLimiter, async (request, response) => {
  const threadId = z.string().cuid().parse(request.params.threadId);
  const input = parse(replySchema, request.body);
  const message = await appendMessage(threadId, 'USER', input.body, request.user!.id);
  const thread = await prisma.messageThread.findUnique({ where: { id: threadId }, select: { subject: true, status: true, lastMessageAt: true } });
  response.status(201).json({ data: { id: message.id, body: message.body, authorRole: message.authorRole, createdAt: message.createdAt.toISOString(), isRead: message.isRead, thread } });
});

/**
 * Admin inbox. Kept beside the user routes so both sides read the same
 * `MessageThread` rows; access is gated by `requirePermission('manage_content')`
 * in the admin router.
 */
export const adminMessagesRouter = Router();

adminMessagesRouter.get('/', async (request, response) => {
  const query = parse(
    z.object({
      status: z.enum(['OPEN', 'ANSWERED', 'CLOSED', 'ALL']).default('ALL'),
      search: z.string().trim().max(100).optional(),
      unread: z.enum(['true', 'false']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
    request.query,
  );
  const { page, limit, skip } = { page: query.page, limit: query.limit, skip: (query.page - 1) * query.limit };
  const where = {
    ...(query.status !== 'ALL' ? { status: query.status } : {}),
    ...(query.unread === 'true' ? { unreadByAdmin: { gt: 0 } } : {}),
    ...(query.search
      ? { OR: [{ subject: { contains: query.search, mode: 'insensitive' as const } }, { user: { email: { contains: query.search, mode: 'insensitive' as const } } }] }
      : {}),
  };
  const [threads, total, unread] = await prisma.$transaction([
    prisma.messageThread.findMany({ where, orderBy: { lastMessageAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, email: true, username: true, displayName: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, authorRole: true, createdAt: true } }, _count: { select: { messages: true } } } }),
    prisma.messageThread.count({ where }),
    prisma.messageThread.aggregate({ where: { unreadByAdmin: { gt: 0 } }, _sum: { unreadByAdmin: true } }),
  ]);
  response.json({
    data: threads.map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      unread: thread.unreadByAdmin,
      lastMessageAt: thread.lastMessageAt.toISOString(),
      createdAt: thread.createdAt.toISOString(),
      user: thread.user,
      messageCount: thread._count.messages,
      lastMessage: thread.messages[0] ? { body: thread.messages[0].body, authorRole: thread.messages[0].authorRole, createdAt: thread.messages[0].createdAt.toISOString() } : undefined,
    })),
    meta: { ...paginationMeta(page, limit, total), unreadCount: unread._sum.unreadByAdmin ?? 0 },
  });
});

adminMessagesRouter.get('/:threadId', async (request, response) => {
  const threadId = z.string().cuid().parse(request.params.threadId);
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: { user: { select: { id: true, email: true, username: true, displayName: true } }, messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!thread) throw new Error('Message thread not found');
  if (thread.unreadByAdmin > 0) {
    await prisma.$transaction([
      prisma.messageThread.update({ where: { id: threadId }, data: { unreadByAdmin: 0 } }),
      prisma.message.updateMany({ where: { threadId, authorRole: 'USER', isRead: false }, data: { isRead: true, readAt: new Date() } }),
    ]);
  }
  response.json({
    data: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      user: thread.user,
      createdAt: thread.createdAt.toISOString(),
      lastMessageAt: thread.lastMessageAt.toISOString(),
      messages: thread.messages.map((message) => ({ id: message.id, body: message.body, authorRole: message.authorRole, createdAt: message.createdAt.toISOString(), isRead: message.isRead })),
    },
  });
});

adminMessagesRouter.post('/:threadId/reply', writeLimiter, async (request, response) => {
  const threadId = z.string().cuid().parse(request.params.threadId);
  const input = parse(replySchema, request.body);
  const author = request.user as { id?: string } | undefined;
  const message = await appendMessage(threadId, 'ADMIN', input.body, author?.id);
  response.status(201).json({ data: { id: message.id, body: message.body, authorRole: message.authorRole, createdAt: message.createdAt.toISOString(), isRead: message.isRead } });
});

adminMessagesRouter.patch('/:threadId', writeLimiter, async (request, response) => {
  const threadId = z.string().cuid().parse(request.params.threadId);
  const input = parse(z.object({ status: z.enum(['OPEN', 'ANSWERED', 'CLOSED']) }), request.body);
  const thread = await prisma.messageThread.update({ where: { id: threadId }, data: { status: input.status } });
  response.json({ data: { id: thread.id, status: thread.status } });
});