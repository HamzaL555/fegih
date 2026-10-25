import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const listQuery = z.object({
  categoryId: z.string().cuid().optional(),
  levelId: z.string().cuid().optional(),
  search: z.string().trim().max(100).optional(),
});

const questionSelect = {
  id: true,
  text: true,
  imageUrl: true,
  points: true,
  categoryId: true,
  levelId: true,
  category: { select: { id: true, name: true, slug: true, iconUrl: true } },
  level: { select: { id: true, name: true, difficulty: true, defaultPoints: true, position: true } },
  _count: { select: { answers: true } },
} as const;

function serializeQuestion<T extends { text: string; imageUrl: string | null; level: { defaultPoints: number } }>(question: T) {
  return {
    ...question,
    questionText: question.text,
    prompt: question.text,
    image: question.imageUrl,
    level: 'level' in question ? { ...question.level, points: question.level.defaultPoints } : undefined,
  };
}

export const questionsRouter = Router();

questionsRouter.get('/', async (request, response) => {
  const query = parse(listQuery, request.query);
  const { page, limit, skip } = getPagination(request);
  const where = {
    status: 'ACTIVE' as const,
    isApproved: true,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.levelId ? { levelId: query.levelId } : {}),
    ...(query.search ? { text: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };
  const [questions, total] = await prisma.$transaction([
    prisma.question.findMany({ where, orderBy: [{ level: { position: 'asc' } }, { position: 'asc' }, { createdAt: 'desc' }], skip, take: limit, select: questionSelect }),
    prisma.question.count({ where }),
  ]);
  response.json({ data: questions.map(serializeQuestion), meta: paginationMeta(page, limit, total) });
});

questionsRouter.get('/categories', async (_request, response) => {
  const categories = await prisma.questionCategory.findMany({
    where: { isActive: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, description: true, iconUrl: true, _count: { select: { questions: { where: { status: 'ACTIVE' } } } } },
  });
  response.json({ data: categories.map((item) => ({ ...item, image: item.iconUrl, questionCount: item._count.questions })) });
});

questionsRouter.get('/levels', async (_request, response) => {
  const levels = await prisma.questionLevel.findMany({
    where: { isActive: true }, orderBy: { position: 'asc' },
    select: { id: true, name: true, difficulty: true, defaultPoints: true, defaultTimeLimit: true, position: true, _count: { select: { questions: { where: { status: 'ACTIVE' } } } } },
  });
  response.json({ data: levels.map((item) => ({ ...item, points: item.defaultPoints, order: item.position, questionCount: item._count.questions })) });
});

questionsRouter.get('/favorites', requireAuth, async (request, response) => {
  const { page, limit, skip } = getPagination(request);
  const where = { userId: request.user!.id };
  const [favorites, total] = await prisma.$transaction([
    prisma.favoriteQuestion.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, select: { question: { select: questionSelect } } }),
    prisma.favoriteQuestion.count({ where }),
  ]);
  response.json({ data: favorites.map((item) => serializeQuestion(item.question)), meta: paginationMeta(page, limit, total) });
});

questionsRouter.get('/:questionId', async (request, response) => {
  const questionId = z.string().cuid().parse(request.params.questionId);
  const question = await prisma.question.findFirst({ where: { id: questionId, status: 'ACTIVE', isApproved: true }, select: questionSelect });
  if (!question) throw ApiError.notFound('Question not found');
  response.json({ data: serializeQuestion(question) });
});

questionsRouter.post('/:questionId/favorite', requireAuth, writeLimiter, async (request, response) => {
  const questionId = z.string().cuid().parse(request.params.questionId);
  if (!await prisma.question.findFirst({ where: { id: questionId, status: 'ACTIVE' }, select: { id: true } })) throw ApiError.notFound('Question not found');
  await prisma.favoriteQuestion.upsert({ where: { userId_questionId: { userId: request.user!.id, questionId } }, update: {}, create: { userId: request.user!.id, questionId } });
  response.status(201).json({ data: { questionId, isFavorite: true } });
});

questionsRouter.delete('/:questionId/favorite', requireAuth, writeLimiter, async (request, response) => {
  const questionId = z.string().cuid().parse(request.params.questionId);
  await prisma.favoriteQuestion.deleteMany({ where: { userId: request.user!.id, questionId } });
  response.status(204).send();
});
