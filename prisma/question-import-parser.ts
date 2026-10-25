import { createHash } from 'node:crypto';
import { z } from 'zod';

const legacyQuestionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  question: z.string().trim().min(3),
  correct_answer: z.string().trim().min(1),
  wrong_answers: z.array(z.string().trim().min(1)).min(1).max(8),
  explanation: z.string().trim().optional(),
});

const canonicalAnswerSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean(),
});

const canonicalQuestionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  level: z.coerce.number().int().min(1).max(100),
  points: z.coerce.number().int().min(0).max(1_000_000).optional(),
  question: z.string().trim().min(3).max(10_000),
  answers: z.array(canonicalAnswerSchema).min(2).max(8),
  explanation: z.string().trim().max(10_000).optional(),
  image: z.string().url().optional(),
});

export interface ImportedQuestion {
  itemIndex: number;
  sourceId?: string;
  category?: string;
  level: number;
  points?: number;
  question: string;
  answers: Array<{ text: string; isCorrect: boolean }>;
  explanation?: string;
  image?: string;
  fingerprint: string;
}

export interface ImportIssue {
  itemIndex: number;
  field: string;
  code: string;
  message: string;
}

export interface ParsedQuestionImport {
  valid: boolean;
  questions: ImportedQuestion[];
  issues: ImportIssue[];
  duplicateIndexes: number[];
  total: number;
}

function fingerprint(question: string) {
  return createHash('sha256').update(question.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('az')).digest('hex');
}

export function parseQuestionImport(input: unknown, defaultCategory?: string, defaultLevel = 0): ParsedQuestionImport {
  const source = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { questions?: unknown }).questions)
      ? (input as { questions: unknown[] }).questions
      : null;

  if (!source) {
    return {
      valid: false,
      questions: [],
      issues: [{ itemIndex: 0, field: 'root', code: 'invalid_root', message: 'JSON kökü sual massivi və ya { "questions": [...] } olmalıdır' }],
      duplicateIndexes: [],
      total: 0,
    };
  }

  const questions: ImportedQuestion[] = [];
  const issues: ImportIssue[] = [];
  const firstIndexByFingerprint = new Map<string, number>();
  const duplicateIndexes: number[] = [];

  source.forEach((raw, index) => {
    const isLegacy = raw && typeof raw === 'object' && 'correct_answer' in raw;
    const parsed = isLegacy
      ? legacyQuestionSchema.safeParse(raw)
      : canonicalQuestionSchema.safeParse(raw);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => issues.push({
        itemIndex: index,
        field: issue.path.join('.') || 'root',
        code: issue.code,
        message: issue.message,
      }));
      return;
    }

    const value = parsed.data;
    const answers = isLegacy
      ? [
          { text: (value as z.infer<typeof legacyQuestionSchema>).correct_answer, isCorrect: true },
          ...(value as z.infer<typeof legacyQuestionSchema>).wrong_answers.map((text) => ({ text, isCorrect: false })),
        ]
      : (value as z.infer<typeof canonicalQuestionSchema>).answers;

    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    if (correctCount !== 1) {
      issues.push({ itemIndex: index, field: 'answers', code: 'correct_answer_count', message: 'Hər sualda dəqiq bir düzgün cavab olmalıdır' });
      return;
    }
    const normalizedAnswers = answers.map((answer) => answer.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('az'));
    if (new Set(normalizedAnswers).size !== answers.length) {
      issues.push({ itemIndex: index, field: 'answers', code: 'duplicate_answers', message: 'Cavab variantları bir-birindən fərqli olmalıdır' });
      return;
    }

    const question = isLegacy
      ? (value as z.infer<typeof legacyQuestionSchema>).question
      : (value as z.infer<typeof canonicalQuestionSchema>).question;
    const hash = fingerprint(question);
    const duplicateOf = firstIndexByFingerprint.get(hash);
    if (duplicateOf !== undefined) duplicateIndexes.push(index);
    else firstIndexByFingerprint.set(hash, index);

    if (isLegacy) {
      const legacy = value as z.infer<typeof legacyQuestionSchema>;
      questions.push({
        itemIndex: index,
        sourceId: legacy.id == null ? undefined : String(legacy.id),
        category: defaultCategory,
        level: defaultLevel,
        points: undefined,
        question: legacy.question,
        answers,
        explanation: legacy.explanation,
        fingerprint: hash,
      });
    } else {
      const canonical = value as z.infer<typeof canonicalQuestionSchema>;
      questions.push({
        itemIndex: index,
        sourceId: canonical.id == null ? undefined : String(canonical.id),
        category: canonical.category ?? defaultCategory,
        level: canonical.level,
        points: canonical.points,
        question: canonical.question,
        answers: canonical.answers,
        explanation: canonical.explanation,
        image: canonical.image,
        fingerprint: hash,
      });
    }
  });

  return { valid: issues.length === 0 && questions.length > 0, questions, issues, duplicateIndexes, total: source.length };
}
