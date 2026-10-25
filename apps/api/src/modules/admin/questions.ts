import { Prisma } from '../../config/prisma-client.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const answerSchema = z.object({ id: z.string().cuid().optional(), text: z.string().trim().min(1).max(5000), isCorrect: z.boolean(), position: z.number().int().min(0).optional() });
/**
 * Zod 4 throws on `.partial()` for object schemas that carry refinements, so the
 * cross-field rules live in `validateQuestionInput` instead of `superRefine`.
 */
const questionShape = { text: z.string().trim().min(3).max(20_000).optional(), question: z.string().trim().min(3).max(20_000).optional(), categoryId: z.string().cuid(), levelId: z.string().cuid(), points: z.number().int().min(0).max(1_000_000), explanation: z.string().max(20_000).nullable().optional(), imageUrl: z.string().url().max(2048).nullable().optional(), timeLimitSeconds: z.number().int().min(5).max(600).optional(), status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('ACTIVE'), isApproved: z.boolean().default(true), answers: z.array(answerSchema).min(2).max(8) };
const questionSchema = z.object(questionShape);
function validateQuestionInput(input: z.infer<typeof questionSchema>, { partial = false } = {}): void {
  const issues: string[] = [];
  if (!partial && !input.text && !input.question) issues.push('Question text is required');
  if (input.answers && input.answers.filter((answer) => answer.isCorrect).length !== 1) issues.push('Exactly one correct answer is required');
  if (issues.length) throw ApiError.badRequest(issues.join('. '), { issues });
}
function serialize(question: any) { return { ...question, question: question.text, questionText: question.text, image: question.imageUrl, isActive: question.status === 'ACTIVE', level: question.level ? { ...question.level, points: question.level.defaultPoints, order: question.level.position } : undefined, category: question.category?.name, categoryId: question.category?.id ?? question.categoryId, answerCount: question.answers?.length ?? question._count?.answers }; }
function inputData(input: z.infer<typeof questionSchema>) { return { text: input.text || input.question!, categoryId: input.categoryId, levelId: input.levelId, points: input.points, explanation: input.explanation, imageUrl: input.imageUrl, timeLimitSeconds: input.timeLimitSeconds, status: input.status, isApproved: input.isApproved, answers: { create: input.answers.map((answer, index) => ({ text: answer.text, isCorrect: answer.isCorrect, position: answer.position ?? index })) } }; }
async function assertCategoryAndLevel(input: { categoryId?: string; levelId?: string }): Promise<void> {
  if (input.categoryId && !await prisma.questionCategory.findFirst({ where: { id: input.categoryId, isActive: true } })) throw ApiError.badRequest('Category not found');
  if (input.levelId && !await prisma.questionLevel.findFirst({ where: { id: input.levelId, isActive: true } })) throw ApiError.badRequest('Level not found');
}

export const adminQuestionsRouter = Router();
adminQuestionsRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'QUESTION_MANAGER'));
adminQuestionsRouter.get('/', async (request, response) => { const query = parse(z.object({ search: z.string().max(100).optional(), categoryId: z.string().cuid().optional(), levelId: z.string().cuid().optional(), status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }), request.query); const { page, limit, skip } = { page: query.page, limit: query.limit, skip: (query.page - 1) * query.limit }; const where = { ...(query.status ? { status: query.status } : {}), ...(query.categoryId ? { categoryId: query.categoryId } : {}), ...(query.levelId ? { levelId: query.levelId } : {}), ...(query.search ? { text: { contains: query.search, mode: 'insensitive' as const } } : {}) }; const [data, total] = await prisma.$transaction([prisma.question.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { answers: { orderBy: { position: 'asc' } }, category: true, level: true } }), prisma.question.count({ where })]); response.json({ data: data.map(serialize), meta: paginationMeta(page, limit, total) }); });
adminQuestionsRouter.post('/', writeLimiter, async (request, response) => { const input = parse(questionSchema, request.body); validateQuestionInput(input); await assertCategoryAndLevel(input); const question = await prisma.question.create({ data: { ...inputData(input), createdById: request.user!.id }, include: { answers: { orderBy: { position: 'asc' } }, category: true, level: true } }); response.status(201).json({ data: serialize(question) }); });
adminQuestionsRouter.patch('/:questionId', writeLimiter, async (request, response) => {
  const id = z.string().cuid().parse(request.params.questionId);
  const input = parse(questionSchema.partial(), request.body);
  validateQuestionInput({
    text: input.text ?? input.question,
    categoryId: input.categoryId,
    levelId: input.levelId,
    points: input.points,
    status: input.status,
    isApproved: input.isApproved,
    // `answers` is optional on PATCH: when absent there is nothing to validate,
    // and treating "missing" as "empty" rejected every edit.
    ...(input.answers ? { answers: input.answers } : {}),
  } as z.infer<typeof questionSchema>, { partial: true });
  await assertCategoryAndLevel(input);
  const question = await prisma.$transaction(async (tx) => {
    if (input.answers) {
      // Diff by id instead of delete-and-recreate: `QuizSessionAnswer` keeps a
      // restrictive foreign key to the original answer rows.
      const existing = await tx.questionAnswer.findMany({ where: { questionId: id }, select: { id: true, position: true, text: true } });
      const existingIds = new Set(existing.map((answer) => answer.id));
      const existingTexts = new Map(existing.map((answer) => [answer.id, answer.text.trim()]));
      const keptIds = new Set<string>();

      /**
       * `QuestionAnswer` carries `@@unique([questionId, position])`, so writing
       * the final positions directly makes any reorder collide: moving answer 0
       * to position 1 while answer 1 still sits there trips the constraint and
       * the whole edit fails with "A record with the same unique value already
       * exists". Parking the touched rows in a scratch range first frees every
       * final slot, so the second pass can never overlap a live value.
       */
      const SCRATCH_BASE = 10_000;
      /**
       * Match incoming answers to existing rows. The admin form used to drop
       * the answer `id`, which made every option look like a *new* answer: a row
       * was created for each one while the originals still held positions
       * 0..n, and the save failed with "A record with the same unique value
       * already exists". An answer without a usable id is therefore matched by
       * position (then by text) instead of being blindly created.
       */
      const existingByPosition = new Map(existing.map((answer) => [answer.position, answer.id]));
      const existingByText = new Map<number, string[]>();
      for (const answer of existing) {
        const key = answer.text.trim();
        existingByText.set(key.length, [...(existingByText.get(key.length) ?? []), answer.id]);
      }
      const claimed = new Set<string>();
      const targetOf: Array<string | undefined> = input.answers.map((answer, index) => {
        if (answer.id && existingIds.has(answer.id) && !claimed.has(answer.id)) {
          claimed.add(answer.id);
          return answer.id;
        }
        const byPosition = existingByPosition.get(answer.position ?? index);
        if (byPosition && !claimed.has(byPosition)) {
          claimed.add(byPosition);
          return byPosition;
        }
        const byText = (existingByText.get(answer.text.trim().length) ?? []).find(
          (id) => !claimed.has(id) && existingTexts.get(id) === answer.text.trim(),
        );
        if (byText) {
          claimed.add(byText);
          return byText;
        }
        return undefined;
      });

      for (const [index, target] of targetOf.entries()) {
        if (target) await tx.questionAnswer.update({ where: { id: target }, data: { position: SCRATCH_BASE + index } });
      }

      // A duplicated `position` would still break the constraint, so the array
      // order is used whenever the incoming positions are not a clean set.
      const requested = input.answers.map((answer, index) => answer.position ?? index);
      const positionsAreUnique = new Set(requested).size === requested.length;

      for (const [index, answer] of input.answers.entries()) {
        const position = positionsAreUnique ? requested[index]! : index;
        const target = targetOf[index];
        if (target) {
          keptIds.add(target);
          await tx.questionAnswer.update({ where: { id: target }, data: { text: answer.text, isCorrect: answer.isCorrect, position } });
          continue;
        }
        const created = await tx.questionAnswer.create({ data: { questionId: id, text: answer.text, isCorrect: answer.isCorrect, position } });
        keptIds.add(created.id);
      }
      const removedIds = [...existingIds].filter((answerId) => !keptIds.has(answerId));
      if (removedIds.length) await tx.questionAnswer.deleteMany({ where: { id: { in: removedIds } } });
    }
    return tx.question.update({ where: { id }, data: { ...(input.text || input.question ? { text: input.text || input.question } : {}), ...(input.categoryId ? { categoryId: input.categoryId } : {}), ...(input.levelId ? { levelId: input.levelId } : {}), ...(input.points !== undefined ? { points: input.points } : {}), ...(input.explanation !== undefined ? { explanation: input.explanation } : {}), ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}), ...(input.timeLimitSeconds !== undefined ? { timeLimitSeconds: input.timeLimitSeconds } : {}), ...(input.status ? { status: input.status } : {}), ...(input.isApproved !== undefined ? { isApproved: input.isApproved } : {}), updatedById: request.user!.id }, include: { answers: { orderBy: { position: 'asc' } }, category: true, level: true } });
  });
  response.json({ data: serialize(question) });
});
adminQuestionsRouter.post('/:questionId/restore', writeLimiter, async (request, response) => { const question = await prisma.question.update({ where: { id: z.string().cuid().parse(request.params.questionId) }, data: { status: 'ACTIVE' }, include: { answers: { orderBy: { position: 'asc' } }, category: true, level: true } }); response.json({ data: serialize(question) }); });
adminQuestionsRouter.delete('/:questionId', writeLimiter, async (request, response) => { await prisma.question.update({ where: { id: z.string().cuid().parse(request.params.questionId) }, data: { status: 'ARCHIVED' } }); response.status(204).send(); });

export const adminQuestionCategoriesRouter = Router();
adminQuestionCategoriesRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'QUESTION_MANAGER'));
adminQuestionCategoriesRouter.get('/', async (_request, response) => response.json({ data: await prisma.questionCategory.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }], include: { _count: { select: { questions: true } } } }) }));
const categorySchema = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9-]+$/), description: z.string().max(2000).nullable().optional(), iconUrl: z.string().url().nullable().optional(), position: z.number().int().min(0).optional(), isActive: z.boolean().optional() });
adminQuestionCategoriesRouter.post('/', writeLimiter, async (request, response) => response.status(201).json({ data: await prisma.questionCategory.create({ data: parse(categorySchema, request.body) }) }));
adminQuestionCategoriesRouter.patch('/:categoryId', writeLimiter, async (request, response) => response.json({ data: await prisma.questionCategory.update({ where: { id: z.string().cuid().parse(request.params.categoryId) }, data: parse(categorySchema.partial(), request.body) }) }));
adminQuestionCategoriesRouter.delete('/:categoryId', writeLimiter, async (request, response) => { await prisma.questionCategory.update({ where: { id: z.string().cuid().parse(request.params.categoryId) }, data: { isActive: false } }); response.status(204).send(); });

export const adminQuestionLevelsRouter = Router();
adminQuestionLevelsRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'QUESTION_MANAGER'));
adminQuestionLevelsRouter.get('/', async (_request, response) => response.json({ data: (await prisma.questionLevel.findMany({ orderBy: { position: 'asc' }, include: { _count: { select: { questions: true } } } })).map((level) => ({ ...level, points: level.defaultPoints, order: level.position, questionCount: level._count.questions })) }));
const levelSchema = z.object({ code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(80), difficulty: z.number().int().min(1).max(100), defaultPoints: z.number().int().min(0).max(1_000_000), defaultTimeLimit: z.number().int().min(5).max(600).optional(), position: z.number().int().min(0).optional(), isActive: z.boolean().optional() });
adminQuestionLevelsRouter.post('/', writeLimiter, async (request, response) => response.status(201).json({ data: await prisma.questionLevel.create({ data: parse(levelSchema, request.body) }) }));
adminQuestionLevelsRouter.patch('/:levelId', writeLimiter, async (request, response) => response.json({ data: await prisma.questionLevel.update({ where: { id: z.string().cuid().parse(request.params.levelId) }, data: parse(levelSchema.partial(), request.body) }) }));
adminQuestionLevelsRouter.delete('/:levelId', writeLimiter, async (request, response) => { await prisma.questionLevel.update({ where: { id: z.string().cuid().parse(request.params.levelId) }, data: { isActive: false } }); response.status(204).send(); });
