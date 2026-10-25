import { Prisma } from '../../config/prisma-client.js';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { parse } from '../../lib/zod.js';
import { parseQuestionImport } from '../../lib/question-import.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
/** Rows per transaction / bulk query. Keeps memory flat and statements short. */
const CHUNK = 100;
function inferLevel(fileName: string) { const match = fileName.match(/level\s*[-_]?\s*(\d+)/i); return match ? Number(match[1]) : 0; }
function rowResult(index: number, errors: Array<{ field: string; code: string; message: string }>, duplicate = false) { return { row: index + 1, itemIndex: index, valid: errors.length === 0 && !duplicate, duplicate, fieldErrors: errors, message: errors[0]?.message ?? (duplicate ? 'Duplicate question' : null), raw: undefined }; }
function slugify(value: string) { return value.toLocaleLowerCase('az').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 130) || `category-${Date.now()}`; }
function readJsonFile(buffer: Buffer, fileName: string): unknown {
  try { return JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')); } catch (error) { throw ApiError.badRequest(`JSON parse error: ${error instanceof Error ? error.message : 'invalid JSON'}`, { fileName }); }
}

export const adminQuestionImportRouter = Router();
adminQuestionImportRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'QUESTION_MANAGER'));

adminQuestionImportRouter.post('/preview', upload.single('file'), async (request, response) => {
  if (!request.file) throw ApiError.badRequest('JSON file is required');
  const defaultLevel = Number(request.body.level || inferLevel(request.file.originalname)) || 1;
  const defaultCategory = typeof request.body.category === 'string' ? request.body.category : undefined;
  const raw = readJsonFile(request.file.buffer, request.file.originalname);
  const parsed = parseQuestionImport(raw, defaultCategory, defaultLevel);
  const [categories, levels, existing] = await Promise.all([
    prisma.questionCategory.findMany({ select: { id: true, name: true, slug: true, isActive: true } }),
    prisma.questionLevel.findMany({ select: { id: true, position: true, isActive: true, defaultPoints: true } }),
    // One query for every fingerprint instead of one per row: an 800-row file
    // previously issued 800 sequential queries just to render the preview.
    prisma.question.findMany({ where: { code: { in: parsed.questions.map((item) => `import:${item.fingerprint}`) } }, select: { code: true } }),
  ]);
  const existingCodes = new Set(existing.map((row) => row.code));
  const rows = [] as any[];
  const allRaw = Array.isArray(raw) ? raw : [];
  for (const item of parsed.questions) {
    const errors = parsed.issues.filter((issue) => issue.itemIndex === item.itemIndex).map((issue) => ({ field: issue.field, code: issue.code, message: issue.message }));
    const category = item.category ? categories.find((candidate) => candidate.name.toLocaleLowerCase('az') === item.category!.toLocaleLowerCase('az') || candidate.slug === item.category) : undefined;
    const level = levels.find((candidate) => candidate.position === item.level);
    if (item.category && !category?.isActive) errors.push({ field: 'category', code: 'category_not_found', message: 'Category not found or inactive' });
    if (!level?.isActive) errors.push({ field: 'level', code: 'level_not_found', message: 'Level not found or inactive' });
    const duplicate = existingCodes.has(`import:${item.fingerprint}`) || parsed.duplicateIndexes.includes(item.itemIndex);
    rows.push({ ...rowResult(item.itemIndex, errors, Boolean(duplicate)), valid: errors.length === 0, item });
  }
  for (const issue of parsed.issues) if (!rows.some((row) => row.itemIndex === issue.itemIndex)) rows.push({ ...rowResult(issue.itemIndex, [{ field: issue.field, code: issue.code, message: issue.message }]), raw: allRaw[issue.itemIndex] });
  rows.sort((a, b) => a.row - b.row);
  response.setHeader('Cache-Control', 'no-store');
  response.json({ data: { rows, total: rows.length, valid: rows.filter((row) => row.valid).length, invalid: rows.filter((row) => !row.valid).length } });
});

adminQuestionImportRouter.post('/', upload.single('file'), writeLimiter, async (request, response) => {
  if (!request.file) throw ApiError.badRequest('JSON file is required');
  const defaultLevel = Number(request.body.level || inferLevel(request.file.originalname)) || 1;
  const defaultCategory = typeof request.body.category === 'string' ? request.body.category : 'İslam ümumi';
  const raw = readJsonFile(request.file.buffer, request.file.originalname);
  const parsed = parseQuestionImport(raw, defaultCategory, defaultLevel);
  if (!parsed.valid) throw ApiError.badRequest('Import contains validation errors', { issues: parsed.issues });

  const batch = await prisma.importBatch.create({ data: { fileName: request.file.originalname, source: 'ADMIN_JSON', createdById: request.user!.id, status: 'PROCESSING', totalItems: parsed.questions.length, startedAt: new Date() } });

  // Resolve categories, levels, and existing questions up front: three bulk
  // reads instead of five sequential queries per row.
  const [levels, existingRows, knownCategories] = await Promise.all([
    prisma.questionLevel.findMany({ select: { id: true, position: true, defaultPoints: true, isActive: true } }),
    prisma.question.findMany({ where: { code: { in: parsed.questions.map((item) => `import:${item.fingerprint}`) } }, select: { id: true, code: true } }),
    prisma.questionCategory.findMany({ select: { id: true, name: true, slug: true, isActive: true } }),
  ]);
  const levelByPosition = new Map(levels.map((level) => [level.position, level]));
  const categoryByName = new Map(knownCategories.map((category) => [category.name.toLocaleLowerCase('az'), category]));
  const existingByCode = new Map(existingRows.map((row) => [row.code, row.id]));

  const wantedCategoryNames = [...new Set(parsed.questions.map((item) => item.category ?? defaultCategory).map((name) => name.toLocaleLowerCase('az')))].filter((name) => !categoryByName.has(name));
  if (wantedCategoryNames.length) {
    await prisma.questionCategory.createMany({
      data: wantedCategoryNames.map((name) => ({ name, slug: slugify(name), isActive: true })),
      skipDuplicates: true,
    });
  }
  const categories = await prisma.questionCategory.findMany({ select: { id: true, name: true } });
  const categoryByNameLower = new Map(categories.map((category) => [category.name.toLocaleLowerCase('az'), category.id]));

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const skippedItems: Prisma.QuestionImportItemCreateManyInput[] = [];
  const failedItems: Prisma.QuestionImportItemCreateManyInput[] = [];

  for (let start = 0; start < parsed.questions.length; start += CHUNK) {
    const chunk = parsed.questions.slice(start, start + CHUNK);
    const prepared = chunk.map((item) => {
      if (parsed.duplicateIndexes.includes(item.itemIndex) || existingByCode.has(`import:${item.fingerprint}`)) return { item, skip: true as const };
      const categoryId = categoryByNameLower.get((item.category ?? defaultCategory).toLocaleLowerCase('az'));
      const level = levelByPosition.get(item.level);
      if (!categoryId || !level?.isActive) return { item, skip: true as const, error: `Category or level ${item.level} is missing or inactive` };
      const ordered = [...item.answers];
      const correctIndex = Number.parseInt(item.fingerprint.slice(0, 8), 16) % ordered.length;
      const correct = ordered.splice(ordered.findIndex((answer) => answer.isCorrect), 1)[0]!;
      ordered.splice(correctIndex, 0, correct);
      return { item, skip: false as const, categoryId, level, answers: ordered };
    });

    const insertable = prepared.filter((row) => !row.skip);
    // `upsert` (not `create`) so re-importing a file that shares external ids
    // no longer fails the whole row on the unique constraint.
    const sourceReferences = await Promise.all(insertable.map((row) => prisma.sourceReference.upsert({
      where: { source_externalId: { source: 'ADMIN_JSON', externalId: `${defaultLevel}-${row.item.sourceId ?? row.item.fingerprint.slice(0, 16)}` } },
      update: { checksum: row.item.fingerprint },
      create: { source: 'ADMIN_JSON', externalId: `${defaultLevel}-${row.item.sourceId ?? row.item.fingerprint.slice(0, 16)}`, checksum: row.item.fingerprint, metadata: { categoryId: row.categoryId, levelId: row.level.id } as unknown as Prisma.InputJsonValue },
      select: { id: true },
    })));
    const sourceByFingerprint = new Map(insertable.map((row, index) => [row.item.fingerprint, sourceReferences[index]!.id]));

    await prisma.$transaction(async (tx) => {
      for (const row of prepared) {
        if (row.skip) {
          if ('error' in row && row.error) {
            failed += 1;
            failedItems.push({ batchId: batch.id, rowNumber: row.item.itemIndex + 1, status: 'FAILED', rawData: row.item as unknown as Prisma.InputJsonValue, errors: { message: row.error } as unknown as Prisma.InputJsonValue });
          } else {
            skipped += 1;
            skippedItems.push({ batchId: batch.id, questionId: existingByCode.get(`import:${row.item.fingerprint}`) ?? null, rowNumber: row.item.itemIndex + 1, status: 'SKIPPED', rawData: row.item as unknown as Prisma.InputJsonValue, errors: { code: 'duplicate' } as unknown as Prisma.InputJsonValue });
          }
          continue;
        }
        try {
          const created = await tx.question.create({
            data: {
              code: `import:${row.item.fingerprint}`,
              text: row.item.question,
              explanation: row.item.explanation,
              imageUrl: row.item.image,
              categoryId: row.categoryId,
              levelId: row.level.id,
              points: row.item.points ?? row.level.defaultPoints,
              status: 'ACTIVE',
              isApproved: true,
              sourceReferenceId: sourceByFingerprint.get(row.item.fingerprint),
              createdById: request.user!.id,
              answers: { create: row.answers.map((answer, position) => ({ text: answer.text, isCorrect: answer.isCorrect, position })) },
            },
            select: { id: true },
          });
          await tx.questionImportItem.create({ data: { batchId: batch.id, questionId: created.id, sourceReferenceId: sourceByFingerprint.get(row.item.fingerprint), rowNumber: row.item.itemIndex + 1, status: 'IMPORTED', rawData: row.item as unknown as Prisma.InputJsonValue, normalizedData: { levelId: row.level.id, categoryId: row.categoryId, points: row.item.points ?? row.level.defaultPoints } as unknown as Prisma.InputJsonValue } });
          existingByCode.set(`import:${row.item.fingerprint}`, created.id);
          imported += 1;
        } catch (error) {
          failed += 1;
          failedItems.push({ batchId: batch.id, rowNumber: row.item.itemIndex + 1, status: 'FAILED', rawData: row.item as unknown as Prisma.InputJsonValue, errors: { message: error instanceof Error ? error.message : 'Import failed' } as unknown as Prisma.InputJsonValue });
        }
      }
    });
  }

  if (skippedItems.length) await prisma.questionImportItem.createMany({ data: skippedItems });
  if (failedItems.length) await prisma.questionImportItem.createMany({ data: failedItems });

  const updated = await prisma.importBatch.update({ where: { id: batch.id }, data: { status: failed ? 'PARTIAL' : 'COMPLETED', processedItems: parsed.questions.length, importedItems: imported, skippedItems: skipped, failedItems: failed, finishedAt: new Date() } });
  response.setHeader('Cache-Control', 'no-store');
  response.status(failed ? 207 : 201).json({ data: { batchId: updated.id, imported, skipped, failed, total: parsed.questions.length } });
});

/** Import history so the panel can show what was loaded and from where. */
adminQuestionImportRouter.get('/', async (request, response) => {
  const limit = z.coerce.number().int().min(1).max(100).default(20).parse(request.query.limit);
  const batches = await prisma.importBatch.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, fileName: true, source: true, status: true, totalItems: true, processedItems: true, importedItems: true, skippedItems: true, failedItems: true, createdAt: true, finishedAt: true } });
  response.json({ data: batches });
});
adminQuestionImportRouter.get('/:batchId', async (request, response) => {
  const id = z.string().cuid().parse(request.params.batchId);
  const batch = await prisma.importBatch.findUnique({ where: { id }, select: { id: true, fileName: true, source: true, status: true, totalItems: true, processedItems: true, importedItems: true, skippedItems: true, failedItems: true, createdAt: true, finishedAt: true } });
  if (!batch) throw ApiError.notFound('Import batch not found');
  const items = await prisma.questionImportItem.findMany({ where: { batchId: id }, orderBy: { rowNumber: 'asc' }, take: 200, select: { id: true, rowNumber: true, status: true, questionId: true, errors: true } });
  response.json({ data: { ...batch, items } });
});

/** Reusable category upsert for the question/level manager. */
adminQuestionImportRouter.post('/categories', writeLimiter, async (request, response) => {
  const input = parse(z.object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9-]+$/).optional() }), request.body);
  const slug = input.slug ?? slugify(input.name);
  const category = await prisma.questionCategory.upsert({ where: { slug }, update: { name: input.name }, create: { name: input.name, slug } });
  response.status(201).json({ data: category });
});
