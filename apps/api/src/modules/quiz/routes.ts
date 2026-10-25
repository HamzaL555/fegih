import { Prisma } from '../../config/prisma-client.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { applyPointChange } from '../rewards/points.js';
import { answerQuestion, finishGame, getGameState, startGame } from './service.js';

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

const startSchema = z.object({
  categoryId: z.string().cuid().optional(),
  levelId: z.string().cuid().optional(),
  level: z.number().int().min(1).max(100).optional(),
  questionCount: z.number().int().min(1).max(30).optional(),
  /**
   * The session the player just lost. Every question from it is kept out of the
   * new draw so a restart really does serve different questions.
   */
  excludeSessionId: z.string().cuid().optional(),
});
const answerSchema = z.object({ questionId: z.string().cuid().optional(), answerId: z.string().cuid().nullable(), skipped: z.boolean().default(false) });
const types = ['FIFTY_FIFTY', 'SECOND_CHANCE', 'SKIP', 'EXTRA_TIME', 'HINT'] as const;

export const quizRouter = Router();
quizRouter.use(requireAuth);

quizRouter.post('/start', writeLimiter, async (request, response) => response.status(201).json({ data: await startGame(request.user!.id, parse(startSchema, request.body)) }));
quizRouter.get('/lifelines/inventory', async (request, response) => {
  const inventory = await prisma.userLifelineInventory.findMany({ where: { userId: request.user!.id, quantity: { gt: 0 } }, orderBy: { type: 'asc' } });
  response.json({ data: inventory.map((item) => ({ ...item, name: item.type })) });
});
quizRouter.post('/lifelines/:type/purchase', writeLimiter, async (request, response) => {
  const type = z.enum(types).parse(request.params.type);
  const config = await prisma.gameLifeline.findFirst({ where: { type, isEnabled: true, game: { isActive: true } }, include: { game: true } });
  if (!config) throw ApiError.notFound('Lifeline is not available');
  const inventory = await prisma.$transaction(async (tx) => {
    await applyPointChange(tx, { userId: request.user!.id, amount: -config.cost, type: 'LIFELINE_PURCHASE', description: `Purchased ${config.name ?? type}`, sourceType: 'LIFELINE', sourceId: config.id, idempotencyKey: `lifeline:${request.user!.id}:${config.id}:${Date.now()}` });
    return tx.userLifelineInventory.upsert({ where: { userId_type: { userId: request.user!.id, type } }, update: { quantity: { increment: 1 }, version: { increment: 1 } }, create: { userId: request.user!.id, type, quantity: 1 } });
  });
  response.status(201).json({ data: { ...inventory, lifeline: config } });
});
quizRouter.get('/:gameId', async (request, response) => response.json({ data: await getGameState(request.user!.id, z.string().cuid().parse(request.params.gameId)) }));
quizRouter.post('/:gameId/answer', writeLimiter, async (request, response) => {
  const input = parse(answerSchema, request.body);
  response.json({ data: await answerQuestion(request.user!.id, z.string().cuid().parse(request.params.gameId), input.questionId, input.answerId, input.skipped) });
});
quizRouter.post('/:gameId/finish', writeLimiter, async (request, response) => { const id = z.string().cuid().parse(request.params.gameId); const session = await finishGame(request.user!.id, id); const state = await getGameState(request.user!.id, id); response.json({ data: { ...session, ...state, points: session.score, earnedPoints: session.score } }); });

quizRouter.post('/:gameId/lifelines/:type/use', writeLimiter, async (request, response) => {
  const sessionId = z.string().cuid().parse(request.params.gameId);
  const type = z.enum(types).parse(request.params.type);
  const session = await prisma.quizSession.findFirst({ where: { id: sessionId, userId: request.user!.id, status: 'IN_PROGRESS' }, include: { questions: { where: { answeredAt: null, skippedAt: null }, orderBy: { order: 'asc' }, take: 1, include: { question: { include: { answers: true } } } }, lifelines: true } });
  if (!session) throw ApiError.notFound('Active quiz game not found');
  const current = session.questions[0];
  if (!current) throw ApiError.conflict('No unanswered question remains');
  // A per-question lifeline must be spent on the question it was granted for;
  // session-wide ones carry `questionId === null`. This is what keeps 50/50
  // from showing up on the question after the one it was used on.
  const sessionLifeline = session.lifelines.find((item) => item.type === type && item.status === 'AVAILABLE' && (!item.questionId || item.questionId === current.id));
  if (!sessionLifeline) throw ApiError.conflict('Lifeline is not available for this question');
  const result0 = { type, applied: true, questionId: current.questionId };
  let result: Record<string, unknown> = { ...result0 };
  if (type === 'FIFTY_FIFTY') {
    const wrong = shuffle(current.question.answers.filter((answer) => !answer.isCorrect)).slice(0, 2);
    result = { ...result0, eliminatedAnswerIds: wrong.map((answer) => answer.id) };
  } else if (type === 'HINT') {
    const explanation = current.question.explanation;
    result = { ...result0, hint: explanation ? explanation.slice(0, Math.max(20, Math.ceil(explanation.length / 2))) : 'Şıklardan biri İslami biliklərə ən uyğun cavabdır.' };
  } else if (type === 'EXTRA_TIME') {
    // Persist the extra seconds so a visible countdown actually grows.
    await prisma.sessionQuestion.update({ where: { id: current.id }, data: { timeLimitSeconds: { increment: 15 } } });
    result = { ...result0, extraSeconds: 15 };
  } else if (type === 'SECOND_CHANCE') {
    result = { ...result0, armedForQuestionId: current.questionId };
  }
  // The inventory decrement and the USED marker must be atomic, otherwise a
  // double tap burns two lives for one lifeline.
  await prisma.$transaction(async (tx) => {
    const inventory = await tx.userLifelineInventory.updateMany({ where: { userId: request.user!.id, type, quantity: { gt: 0 } }, data: { quantity: { decrement: 1 }, version: { increment: 1 } } });
    if (!inventory.count) throw new ApiError(409, 'LIFELINE_NOT_OWNED', 'You do not own this lifeline');
    await tx.quizSessionLifeline.update({ where: { id: sessionLifeline.id }, data: { status: 'USED', usedAt: new Date(), result: result as Prisma.InputJsonValue, ...(type === 'SECOND_CHANCE' ? { sessionQuestionId: current.id } : {}) } });
  });
  if (type === 'SKIP') {
    // A skipped question can never be part of a 10/10 level, so it ends the run
    // (`answerQuestion` already resets the score and closes the session). The
    // `gameOver` flag is passed up explicitly because this endpoint returns the
    // full game state, not the answer payload the client would normally read.
    const skipped = await answerQuestion(request.user!.id, sessionId, current.questionId, null, true);
    // `skipped.game` is a partial snapshot: spreading it over the full game
    // state dropped `availableLifelines` and `expiresAt` mid-game.
    const { game: _partial, ...rest } = skipped;
    response.json({ data: { ...result, ...rest, type, ...(await getGameState(request.user!.id, sessionId)) } });
    return;
  }
  response.json({ data: { ...result, ...(await getGameState(request.user!.id, sessionId)) } });
});
