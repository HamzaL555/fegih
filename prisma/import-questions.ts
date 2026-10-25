import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { parseQuestionImport } from './question-import-parser';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const valueAfter = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const has = (flag: string) => args.includes(flag);
const inputPath = resolve(process.cwd(), args.find((arg) => !arg.startsWith('--') && !args[args.indexOf(arg) - 1]?.startsWith('--')) ?? 'questions.json');
const recursive = has('--recursive');
const commit = has('--commit');
const defaultLevel = Number(valueAfter('--level') ?? 0);
const defaultCategory = valueAfter('--category') ?? 'İslam ümumi';
const source = path => basename(path).match(/^level\s*[-_]?\s*(\d+)/i)?.[1] ? Number(basename(path).match(/^level\s*[-_]?\s*(\d+)/i)![1]) : defaultLevel;
const slug = (value: string) => value.toLocaleLowerCase('az').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 130) || `category-${Date.now()}`;
const hash = (value: string) => createHash('sha256').update(value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('az')).digest('hex');

async function filesAt(path: string): Promise<string[]> { const info = await stat(path); if (info.isFile()) return path.toLowerCase().endsWith('.json') ? [path] : []; if (!recursive) return []; const result: string[] = []; for (const entry of await readdir(path)) result.push(...await filesAt(join(path, entry))); return result; }

async function main() {
  const files = await filesAt(inputPath);
  if (!files.length) throw new Error('No JSON files found');
  let totalImported = 0; let totalSkipped = 0;
  for (const file of files) {
    const raw = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
    const parsed = parseQuestionImport(raw, defaultCategory, source(file) || defaultLevel || 1);
    if (!parsed.valid) { console.error(`[${file}] validation failed`); for (const issue of parsed.issues) console.error(`  item ${issue.itemIndex ?? '-'}: ${issue.field}: ${issue.message}`); continue; }
    const category = await prisma.questionCategory.upsert({ where: { slug: slug(defaultCategory) }, update: {}, create: { name: defaultCategory, slug: slug(defaultCategory) } });
    let imported = 0; let skipped = 0;
    for (const item of parsed.questions) {
      const levelNumber = item.level || source(file) || defaultLevel || 1;
      const level = await prisma.questionLevel.findUnique({ where: { code: `LEVEL_${String(levelNumber).padStart(2, '0')}` } });
      if (!level || !level.isActive) { console.error(`[${file}] level ${levelNumber} is not configured`); continue; }
      const categoryName = item.category ?? defaultCategory;
      const itemCategory = categoryName === defaultCategory ? category : await prisma.questionCategory.upsert({ where: { slug: slug(categoryName) }, update: {}, create: { name: categoryName, slug: slug(categoryName) } });
      const code = `import:${item.fingerprint}`;
      if (await prisma.question.findUnique({ where: { code }, select: { id: true } })) { skipped += 1; continue; }
      if (!commit) { console.log(`[preview] ${file} item ${item.itemIndex + 1}: ${item.question}`); continue; }
      const sourceReference = await prisma.sourceReference.upsert({ where: { source_externalId: { source: 'CLI_JSON', externalId: `${levelNumber}-${item.sourceId ?? item.fingerprint.slice(0, 12)}` } }, update: { checksum: item.fingerprint }, create: { source: 'CLI_JSON', externalId: `${levelNumber}-${item.sourceId ?? item.fingerprint.slice(0, 12)}`, checksum: item.fingerprint } });
      const answers = [...item.answers]; const correct = answers.splice(answers.findIndex((answer) => answer.isCorrect), 1)[0]!; const position = Number.parseInt(item.fingerprint.slice(0, 8), 16) % answers.length; answers.splice(position, 0, correct);
      await prisma.question.create({ data: { code, text: item.question, explanation: item.explanation, imageUrl: item.image, categoryId: itemCategory.id, levelId: level.id, points: item.points ?? level.defaultPoints, status: 'ACTIVE', isApproved: true, sourceReferenceId: sourceReference.id, answers: { create: answers.map((answer, index) => ({ text: answer.text, isCorrect: answer.isCorrect, position: index })) } } });
      imported += 1;
    }
    totalImported += imported; totalSkipped += skipped;
    console.log(`[${commit ? 'import' : 'preview'}] ${file}: imported=${imported} skipped=${skipped} total=${parsed.total}`);
  }
  if (!commit) console.log('\nPreview tamamlandı. Yazmaq üçün --commit əlavə edin.');
  else console.log(`\nImport tamamlandı: imported=${totalImported} skipped=${totalSkipped}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
