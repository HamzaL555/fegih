import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    messageThread: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    message: { create: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../config/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../notifications/service.js', () => ({ notifyUser: vi.fn(async () => undefined) }));

import { appendMessage, getThread } from './service.js';

describe('missing message threads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getThread returns 404 when the thread does not exist or is not the user\'s', async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(null);

    await expect(getThread('user-1', 'thread-1')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('appendMessage returns 404 for an unknown thread', async () => {
    prismaMock.messageThread.findUnique.mockResolvedValue(null);

    await expect(appendMessage('thread-1', 'USER', 'hello', 'user-1')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('appendMessage returns 404 when a user replies to another user\'s thread', async () => {
    prismaMock.messageThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      userId: 'other-user',
      status: 'OPEN',
    });

    await expect(appendMessage('thread-1', 'USER', 'hello', 'user-1')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});
