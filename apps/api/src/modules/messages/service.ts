/**
 * Support conversations: the user asks a question, an admin answers from the
 * admin panel, and the user is notified when the reply lands.
 *
 * Read state is tracked per side (`unreadByUser` / `unreadByAdmin`) because the
 * two participants have very different access patterns: a user checks their own
 * inbox, an admin works a queue.
 */
import { Prisma } from '../../config/prisma-client.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { notifyUser } from '../notifications/service.js';

export interface ThreadListItem {
  id: string;
  subject: string;
  status: 'OPEN' | 'ANSWERED' | 'CLOSED';
  unread: number;
  lastMessageAt: string;
  createdAt: string;
  /** Present only for the admin view. */
  user?: { id: string; email: string | null; username: string; displayName: string };
  lastMessage?: { body: string; authorRole: 'USER' | 'ADMIN'; createdAt: string };
  messageCount?: number;
}

const threadInclude = {
  user: { select: { id: true, email: true, username: true, displayName: true } },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { body: true, authorRole: true, createdAt: true } },
  _count: { select: { messages: true } },
};

function serializeThread(
  thread: Prisma.MessageThreadGetPayload<{ include: typeof threadInclude }>,
  viewer: 'USER' | 'ADMIN',
): ThreadListItem {
  const last = thread.messages?.[0];
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    unread: viewer === 'ADMIN' ? thread.unreadByAdmin : thread.unreadByUser,
    lastMessageAt: thread.lastMessageAt.toISOString(),
    createdAt: thread.createdAt.toISOString(),
    ...(viewer === 'ADMIN' && thread.user ? { user: thread.user } : {}),
    ...(last ? { lastMessage: { body: last.body, authorRole: last.authorRole, createdAt: last.createdAt.toISOString() } } : {}),
    ...(thread._count ? { messageCount: thread._count.messages } : {}),
  };
}

/** Opens a thread with the user's first message. */
export async function createThread(userId: string, subject: string, body: string) {
  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.messageThread.create({ data: { userId, subject, status: 'OPEN', unreadByAdmin: 1 } });
    await tx.message.create({ data: { threadId: created.id, authorRole: 'USER', authorId: userId, body } });
    return created;
  });
  // `lastMessageAt` is set once at creation; the first message shares that time.
  return getThread(userId, thread.id);
}

/** Appends a message and flips the unread counter on the *other* side. */
export async function appendMessage(threadId: string, author: 'USER' | 'ADMIN', body: string, authorId?: string) {
  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } });
  if (!thread) throw ApiError.notFound('Message thread not found');
  if (thread.status === 'CLOSED') throw ApiError.conflict('Bu söhbə bağlanıb');

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({ data: { threadId, authorRole: author, authorId, body } });
    await tx.messageThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: new Date(),
        // A user reply re-opens an answered thread so it is never silently lost.
        status: author === 'ADMIN' ? 'ANSWERED' : 'OPEN',
        unreadByAdmin: author === 'USER' ? { increment: 1 } : 0,
        unreadByUser: author === 'ADMIN' ? { increment: 1 } : 0,
      },
    });
    return message;
  });

  // An admin reply has to reach the user's device.
  if (author === 'ADMIN') {
    await notifyUser(thread.userId, 'MESSAGE_REPLY', 'Yeni cavabınız var', body.slice(0, 160), { threadId, messageId: created.id })
      .catch(() => undefined);
  }
  return created;
}

/**
 * A thread plus its messages. Opening it as the given viewer clears that
 * viewer's unread counter, which is what makes the badge go away.
 */
export async function getThread(userId: string, threadId: string) {
  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      _count: { select: { messages: true } },
    },
  });
  if (!thread) throw ApiError.notFound('Message thread not found');
  if (thread.unreadByUser > 0) {
    await prisma.$transaction([
      prisma.messageThread.update({ where: { id: threadId }, data: { unreadByUser: 0 } }),
      prisma.message.updateMany({ where: { threadId, authorRole: 'ADMIN', isRead: false }, data: { isRead: true, readAt: new Date() } }),
    ]);
  }
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    createdAt: thread.createdAt.toISOString(),
    lastMessageAt: thread.lastMessageAt.toISOString(),
    messageCount: thread._count.messages,
    messages: thread.messages.map((message) => ({
      id: message.id,
      body: message.body,
      authorRole: message.authorRole,
      createdAt: message.createdAt.toISOString(),
      isRead: message.isRead,
    })),
  };
}

export async function listThreads(userId: string) {
  const threads = await prisma.messageThread.findMany({
    where: { userId },
    orderBy: { lastMessageAt: 'desc' },
    include: threadInclude,
  });
  return threads.map((thread) => serializeThread(thread, 'USER'));
}

export async function countUnread(userId: string) {
  return prisma.messageThread.aggregate({ where: { userId, unreadByUser: { gt: 0 } }, _sum: { unreadByUser: true } });
}