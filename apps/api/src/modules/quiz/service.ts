import { createHash, randomInt } from 'node:crypto';
import { Prisma } from '../../config/prisma-client.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { getSystemSetting } from '../../lib/settings-cache.js';
import { evaluateAchievements } from '../achievements/service.js';
import { updateMissions } from '../missions/service.js';
import { applyPointChange } from '../rewards/points.js';
import { LEVEL_LADDER, MAX_LEVELS, QUESTIONS_PER_LEVEL, TOTAL_MAX_POINTS, TOTAL_QUESTIONS, levelMaxPoints, pointsForLevel } from './sual-cavab.js';

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function stableOptions<T extends { id: string }>(items: T[], seed: string) {
  return [...items].sort((a, b) => createHash('sha256').update(`${seed}:${a.id}`).digest('hex').localeCompare(createHash('sha256').update(`${seed}:${b.id}`).digest('hex')));
}

const sessionQuestionInclude = {
  question: { include: { answers: { orderBy: { position: 'asc' as const } }, level: { select: { name: true, position: true } } } },
} as const;

function publicQuestion(sq: { id: string; order: number; pointValue: number; timeLimitSeconds: number; question: { id: string; text: string; imageUrl: string | null; level?: { name: string } | null; answers: Array<{ id: string; text: string; position: number }> } }) {
  return {
    id: sq.question.id,
    text: sq.question.text,
    prompt: sq.question.text,
    image: sq.question.imageUrl,
    points: sq.pointValue,
    levelName: sq.question.level?.name ?? null,
    index: sq.order,
    timeLimitSeconds: sq.timeLimitSeconds,
    // `explanation` is deliberately omitted: sending it before the question was
    // answered gave the answer away and made the HINT lifeline pointless. It is
    // returned in the answer result instead.
    options: stableOptions(sq.question.answers, sq.id).map((answer) => ({ id: answer.id, text: answer.text })),
  };
}

async function getActiveGame() {
  const game = await prisma.quizGame.findFirst({ where: { isActive: true, status: 'ACTIVE' }, orderBy: { position: 'asc' }, include: { gameLifelines: { where: { isEnabled: true } } } });
  if (game) return game;
  try {
    return await prisma.quizGame.create({ data: { code: 'QUICK-QUIZ', name: 'Quick Quiz', questionCount: 10, isActive: true, status: 'ACTIVE', gameLifelines: { create: [
      { type: 'FIFTY_FIFTY', name: '50/50', cost: 100, maxPerSession: 1, scope: 'SESSION' },
      { type: 'SECOND_CHANCE', name: 'Second Chance', cost: 150, maxPerSession: 1, scope: 'SESSION' },
      // Skip and extra time only make sense for the question in front of you,
      // so they are granted per question rather than once per game.
      { type: 'SKIP', name: 'Skip Question', cost: 75, maxPerSession: 1, scope: 'QUESTION' },
      { type: 'EXTRA_TIME', name: 'Extra Time', cost: 50, maxPerSession: 1, scope: 'QUESTION' },
      { type: 'HINT', name: 'Hint', cost: 80, maxPerSession: 1, scope: 'SESSION' },
    ] } }, include: { gameLifelines: { where: { isEnabled: true } } } });
  } catch (error) {
    // Two concurrent starts race on the unique `code`; re-read the winner.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.quizGame.findFirst({ where: { isActive: true, status: 'ACTIVE' }, orderBy: { position: 'asc' }, include: { gameLifelines: { where: { isEnabled: true } } } });
      if (existing) return existing;
    }
    throw error;
  }
}

/**
 * Picks `count` random questions from the level at `position`.
 *
 * `excludeIds` is what makes a restart genuinely different: the client sends
 * the previous session id and every question from that run is kept out of the
 * new draw.
 */
async function drawLevelQuestions(
  tx: Prisma.TransactionClient | typeof prisma,
  position: number,
  count: number,
  excludeIds: string[] = [],
) {
  const level = await tx.questionLevel.findFirst({
    where: { position, isActive: true },
    select: { id: true, defaultTimeLimit: true, name: true },
  });
  if (!level) throw ApiError.badRequest(`Sual səviyyəsi ${position} tapılmadı və ya aktiv deyil`);

  const pool = await tx.question.findMany({
    where: {
      status: 'ACTIVE',
      isApproved: true,
      levelId: level.id,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    },
    select: { id: true, timeLimitSeconds: true },
  });
  if (!pool.length) {
    throw ApiError.badRequest(
      excludeIds.length
        ? `${level.name} səviyyəsində yeni sual qalmadı (keçən oyundakı ${excludeIds.length} sual çıxarıldı)`
        : `${level.name} səviyyəsində aktiv sual yoxdur`,
    );
  }

  return shuffle(pool).slice(0, Math.min(count, pool.length)).map((question) => ({
    questionId: question.id,
    // The value of a correct answer is the level number, not whatever the
    // question row happens to carry.
    pointValue: pointsForLevel(position),
    timeLimitSeconds: question.timeLimitSeconds || level.defaultTimeLimit || 30,
  }));
}

/** Question ids already used by a previous run, so a restart can avoid them. */
async function usedQuestionIds(userId: string, sessionId: string | undefined) {
  if (!sessionId) return [];
  const previous = await prisma.quizSession.findFirst({
    where: { id: sessionId, userId },
    select: { questions: { select: { questionId: true } } },
  });
  return previous?.questions.map((item) => item.questionId) ?? [];
}

export async function startGame(userId: string, input: { categoryId?: string; levelId?: string; level?: number; questionCount?: number; excludeSessionId?: string }) {
  const setting = await getSystemSetting<boolean | { enabled?: boolean }>('quizEnabled');
  const enabled = typeof setting === 'boolean' ? setting : setting?.enabled;
  if (enabled === false) throw new ApiError(503, 'QUIZ_DISABLED', 'Quiz is temporarily disabled');
  const game = await getActiveGame();
  const level = input.levelId ? await prisma.questionLevel.findFirst({ where: { id: input.levelId, isActive: true } }) : input.level ? await prisma.questionLevel.findFirst({ where: { position: input.level, isActive: true } }) : null;
  if ((input.levelId || input.level) && !level) throw ApiError.badRequest('Question level is invalid or inactive');
  if (input.categoryId && !await prisma.questionCategory.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } })) throw ApiError.badRequest('Question category is invalid or inactive');

  // Per-game category/level weights decide which questions are drawn when the
  // client does not pick a level or category explicitly.
  const scopes = !level && !input.categoryId
    ? await prisma.quizGame.findFirst({ where: { id: game.id }, select: { categoryLinks: { select: { categoryId: true, weight: true } }, levelLinks: { select: { levelId: true, weight: true } } } })
    : null;
  const weightedCategoryIds = scopes?.categoryLinks.filter((item) => item.weight > 0).map((item) => item.categoryId) ?? [];
  const weightedLevelIds = scopes?.levelLinks.filter((item) => item.weight > 0).map((item) => item.levelId) ?? [];

  // "Sual-Cavab" is the game the app plays. A caller that explicitly asks for a
  // level, a category or a question count still gets the custom quiz below.
  if (!level && !input.categoryId && input.questionCount === undefined) {
    return startSualCavab(userId, game, await usedQuestionIds(userId, input.excludeSessionId));
  }

  const candidates = await prisma.question.findMany({
    where: {
      status: 'ACTIVE',
      isApproved: true,
      ...(level ? { levelId: level.id } : weightedLevelIds.length ? { levelId: { in: weightedLevelIds } } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : weightedCategoryIds.length ? { categoryId: { in: weightedCategoryIds } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, points: true, levelId: true, categoryId: true },
  });
  if (!candidates.length) throw ApiError.notFound('No active questions match this selection');

  // Weighted draw: a category/level configured with a higher `weight` appears
  // more often instead of every question being equally likely.
  const weightOf = new Map<string, number>();
  for (const item of scopes?.categoryLinks ?? []) weightOf.set(`c:${item.categoryId}`, item.weight);
  for (const item of scopes?.levelLinks ?? []) weightOf.set(`l:${item.levelId}`, item.weight);
  const pool: typeof candidates = [];
  for (const candidate of candidates) {
    const weight = Math.max(1, weightOf.get(`c:${candidate.categoryId}`) ?? 0) * Math.max(1, weightOf.get(`l:${candidate.levelId}`) ?? 0);
    for (let i = 0; i < weight; i += 1) pool.push(candidate);
  }
  const wanted = Math.min(input.questionCount ?? game.questionCount, candidates.length);
  const bag = shuffle(pool);
  const selected: typeof candidates = [];
  while (selected.length < wanted && bag.length) {
    const next = bag.pop()!;
    if (!selected.some((item) => item.id === next.id)) selected.push(next);
  }

  const session = await prisma.$transaction(async (tx) => {
    const existingAttempts = await tx.quizSession.count({ where: { gameId: game.id, userId } });
    const created = await tx.quizSession.create({ data: { gameId: game.id, userId, attempt: existingAttempts + 1, status: 'IN_PROGRESS', questionCount: selected.length, livesRemaining: game.startingLives, startedAt: new Date(), expiresAt: new Date(Date.now() + 60 * 60_000), questions: { create: selected.map((question, index) => ({ questionId: question.id, order: index, pointValue: question.points || level?.defaultPoints || 100, timeLimitSeconds: level?.defaultTimeLimit ?? game.timePerQuestion })) } } });
    await updateMissions(tx, userId, 'QUIZ_PLAYED', 1);
    return created;
  });

  // Per-question lifelines (skip, extra time) are granted for *each* question, so
  // they stay available for question 2, 3, ... but are consumed on the question
  // they were used on. Session-wide ones (50/50, hint, second chance) are not.
  // `QuizSessionLifeline.questionId` points at `SessionQuestion`, whose ids are
  // only known after the nested create above, hence this second step.
  const perQuestion = game.gameLifelines.filter((item) => item.scope === 'QUESTION');
  const sessionQuestions = await prisma.sessionQuestion.findMany({ where: { sessionId: session.id }, select: { id: true }, orderBy: { order: 'asc' } });
  await prisma.quizSessionLifeline.createMany({
    data: [
      ...game.gameLifelines.filter((item) => item.scope !== 'QUESTION').map((item) => ({ sessionId: session.id, type: item.type, cost: item.cost })),
      ...perQuestion.flatMap((item) => sessionQuestions.map((sq) => ({ sessionId: session.id, type: item.type, cost: item.cost, questionId: sq.id }))),
    ],
    skipDuplicates: true,
  });
  return getGameState(userId, session.id);
}

/**
 * Starts a "Sual-Cavab" run at level 1 with 10 random questions.
 *
 * Only the current level is materialised up front. Level N+1 is drawn the
 * moment level N is cleared with 10/10, which keeps a session small and lets a
 * restart pick genuinely different questions.
 */
async function startSualCavab(userId: string, game: Awaited<ReturnType<typeof getActiveGame>>, excludeIds: string[] = []) {
  const picked = await drawLevelQuestions(prisma, 1, QUESTIONS_PER_LEVEL, excludeIds);

  const session = await prisma.$transaction(async (tx) => {
    const existingAttempts = await tx.quizSession.count({ where: { gameId: game.id, userId } });
    const created = await tx.quizSession.create({
      data: {
        gameId: game.id,
        userId,
        attempt: existingAttempts + 1,
        status: 'IN_PROGRESS',
        // The ladder is always the full 15 levels; `currentLevel` tracks how far
        // the run has actually got.
        questionCount: TOTAL_QUESTIONS,
        currentLevel: 1,
        livesRemaining: game.startingLives,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 6 * 60 * 60_000),
        questions: { create: picked.map((question, index) => ({ ...question, order: index })) },
      },
    });
    await updateMissions(tx, userId, 'QUIZ_PLAYED', 1);
    return created;
  });

  await grantLifelines(session.id, game);
  return getGameState(userId, session.id);
}

/**
 * Session-wide lifelines are granted once; per-question ones for every question
 * currently in the session. `SessionQuestion` ids only exist after the rows are
 * created, so this has to run as a second step.
 */
async function grantLifelines(sessionId: string, game: { gameLifelines: Array<{ type: string; cost: number; scope: string }> }) {
  const perQuestion = game.gameLifelines.filter((item) => item.scope === 'QUESTION');
  const sessionQuestions = await prisma.sessionQuestion.findMany({ where: { sessionId }, select: { id: true }, orderBy: { order: 'asc' } });
  await prisma.quizSessionLifeline.createMany({
    data: [
      ...game.gameLifelines.filter((item) => item.scope !== 'QUESTION').map((item) => ({ sessionId, type: item.type as never, cost: item.cost })),
      ...perQuestion.flatMap((item) => sessionQuestions.map((sq) => ({ sessionId, type: item.type as never, cost: item.cost, questionId: sq.id }))),
    ],
    skipDuplicates: true,
  });
}

export async function getGameState(userId: string, sessionId: string) {
  const session = await prisma.quizSession.findFirst({ where: { id: sessionId, userId }, include: { game: { select: { name: true } }, questions: { where: { answeredAt: null, skippedAt: null }, orderBy: { order: 'asc' }, take: 1, include: sessionQuestionInclude }, lifelines: true } });
  if (!session) throw ApiError.notFound('Quiz game not found');
  // A finished session must not hand out a next question, otherwise a client
  // that only reads the state could keep playing after a game-over.
  const current = session.status === 'IN_PROGRESS' && session.questions[0] ? publicQuestion(session.questions[0]) : null;
  const currentSessionQuestionId = current ? session.questions[0]!.id : undefined;
  // `QuizSessionAnswer` hangs off `SessionQuestion`, so it has no direct
  // relation to the session and must be counted with its own query. The value
  // used to be hard-coded to `undefined`, which made the finished screen show
  // the *last answer's* points as the final score.
  const answered = await prisma.quizSessionAnswer.aggregate({ where: { sessionQuestion: { sessionId } }, _count: { _all: true }, _sum: { pointsAwarded: true } });
  const correctAnswers = await prisma.quizSessionAnswer.count({ where: { sessionQuestion: { sessionId }, isCorrect: true } });
  // A per-question lifeline only shows on the question it belongs to, so 50/50
  // and friends never appear on the question after the one they were used on.
  const availableLifelines = session.lifelines
    .filter((item) => item.status === 'AVAILABLE' && (!item.questionId || item.questionId === currentSessionQuestionId))
    .map((item) => item.type);
  const spentLifelines = session.lifelines
    .filter((item) => item.status === 'USED')
    .map((item) => item.type);

  // How far through the *current* level the run is. A level is only cleared on
  // 10/10, so this is what the progress bar shows.
  const levelQuestions = await prisma.sessionQuestion.findMany({
    where: { sessionId, pointValue: pointsForLevel(session.currentLevel) },
    select: { answeredAt: true, skippedAt: true, answer: { select: { isCorrect: true } } },
  });
  const levelCorrect = levelQuestions.filter((item) => item.answer?.isCorrect).length;
  const levelAnswered = levelQuestions.filter((item) => item.answeredAt || item.skippedAt).length;

  return {
    id: session.id,
    gameId: session.gameId,
    name: session.game.name,
    mode: 'SUAL_CAVAB' as const,
    status: session.status,
    /** The full ladder: 15 levels x 10 questions. */
    totalQuestions: TOTAL_QUESTIONS,
    questionsPerLevel: QUESTIONS_PER_LEVEL,
    maxLevels: MAX_LEVELS,
    /** 1-based level the run is on. */
    level: session.currentLevel,
    levelName: current?.levelName ?? null,
    levelQuestions: levelQuestions.length,
    levelAnswered,
    levelCorrect,
    levelPointsPerAnswer: pointsForLevel(session.currentLevel),
    levelMaxPoints: levelMaxPoints(session.currentLevel),
    /** Score for the run. Reset to 0 by a wrong answer. */
    score: session.score,
    maxScore: TOTAL_MAX_POINTS,
    /** Per-level point ladder for the UI. */
    levelLadder: LEVEL_LADDER,
    currentQuestion: current,
    question: current,
    questionNumber: answered._count._all + 1,
    answeredCount: answered._count._all,
    correctAnswers,
    earnedPoints: answered._sum.pointsAwarded ?? session.score,
    points: answered._sum.pointsAwarded ?? session.score,
    expiresAt: session.expiresAt,
    availableLifelines: [...new Set(availableLifelines)],
    spentLifelines: [...new Set(spentLifelines)],
  };
}

export async function answerQuestion(userId: string, sessionId: string, questionId: string | undefined, answerId: string | null, skipped = false) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.quizSession.findFirst({ where: { id: sessionId, userId }, include: { questions: { include: { question: { include: { answers: true, level: { select: { name: true, position: true } } } }, answer: true, lifelines: true } }, game: { include: { gameLifelines: { where: { isEnabled: true } } } } } });
    if (!session) throw ApiError.notFound('Quiz game not found');
    if (session.status !== 'IN_PROGRESS') throw ApiError.conflict('Quiz game is not active');
    if (session.expiresAt && session.expiresAt < new Date()) throw ApiError.conflict('Quiz session has expired');
    const sq = questionId ? session.questions.find((item) => item.questionId === questionId) : session.questions.find((item) => !item.answer && !item.skippedAt);
    if (!sq) throw ApiError.badRequest('Question is not part of this game');
    if (sq.answer || sq.skippedAt) throw ApiError.conflict('This question has already been answered');

    /**
     * Sual-Cavab rule: a level is only cleared with 10/10 correct, so a skipped
     * question can never count. It therefore ends the run just like a wrong
     * answer instead of leaving the player stuck on a level they can never
     * finish.
     */
    if (skipped) {
      await tx.sessionQuestion.update({ where: { id: sq.id }, data: { skippedAt: new Date() } });
      await updateMissions(tx, userId, 'QUESTION_ANSWERED', 1);
      await tx.quizSession.update({ where: { id: sessionId }, data: { score: 0, status: 'COMPLETED', currentCombo: 0, currentQuestionOrder: session.currentQuestionOrder + 1, completedAt: new Date(), abandonedAt: null } });
      await tx.user.update({ where: { id: userId }, data: { totalGames: { increment: 1 } } });
      return {
        correct: false,
        skipped: true,
        gameOver: true,
        reason: 'SKIPPED' as const,
        correctAnswerId: sq.question.answers.find((answer) => answer.isCorrect)?.id ?? null,
        explanation: sq.question.explanation,
        pointsEarned: 0,
        pointsAwarded: 0,
        totalPoints: 0,
        scoreBeforeReset: session.score,
        resetScore: session.score,
        level: session.currentLevel,
        levelName: sq.question.level?.name ?? null,
        nextQuestion: null,
        completed: true,
        game: { id: session.id, gameId: session.gameId, status: 'COMPLETED' as const, level: session.currentLevel, levelName: sq.question.level?.name ?? null, currentQuestion: null, score: 0, points: 0, totalQuestions: TOTAL_QUESTIONS, questionsPerLevel: QUESTIONS_PER_LEVEL, maxLevels: MAX_LEVELS, maxScore: TOTAL_MAX_POINTS, levelLadder: LEVEL_LADDER },
      };
    }

    const selected = sq.question.answers.find((answer) => answer.id === answerId);
    if (!selected) throw ApiError.badRequest('Answer does not belong to this question');
    const protectedBySecondChance = sq.lifelines.some((item) => item.type === 'SECOND_CHANCE' && item.status === 'USED');
    const isCorrect = selected.isCorrect;
    // `pointValue` was set to the level number when the question was drawn, so a
    // correct answer at level N is always worth N points.
    const points = isCorrect ? sq.pointValue : 0;
    await tx.quizSessionAnswer.create({ data: { sessionQuestionId: sq.id, selectedAnswerId: selected.id, isCorrect, pointsAwarded: points, responseTimeMs: sq.displayedAt ? Math.max(0, Date.now() - sq.displayedAt.getTime()) : undefined } });
    await tx.sessionQuestion.update({ where: { id: sq.id }, data: { answeredAt: new Date() } });
    const stats = await tx.user.update({ where: { id: userId }, data: { correctAnswers: { increment: isCorrect ? 1 : 0 }, ...(isCorrect || protectedBySecondChance ? {} : { wrongAnswers: { increment: 1 } }) }, select: { correctAnswers: true, wrongAnswers: true, points: true } });
    const combo = isCorrect ? session.currentCombo + 1 : 0;

    // A wrong answer ends the run and wipes the score back to 0, as the level
    // can no longer be completed. The user's account points are untouched.
    const gameOver = !isCorrect && !protectedBySecondChance;
    const correctAnswersTotal = await tx.quizSessionAnswer.count({ where: { sessionQuestion: { sessionId }, isCorrect: true } });
    const sessionScore = gameOver ? 0 : session.score + points;

    // Level cleared? Count the correct answers inside the current level only.
    const levelCorrect = await tx.quizSessionAnswer.count({
      where: { isCorrect: true, sessionQuestion: { sessionId, pointValue: pointsForLevel(session.currentLevel) } },
    });
    const clearedLevel = !gameOver && levelCorrect >= QUESTIONS_PER_LEVEL;
    const isFinalLevel = session.currentLevel >= MAX_LEVELS;
    const nextLevel = clearedLevel && !isFinalLevel ? session.currentLevel + 1 : session.currentLevel;
    const status = gameOver || (clearedLevel && isFinalLevel) ? 'COMPLETED' : 'IN_PROGRESS';

    // The next level's questions only exist once 10/10 were correct, and they
    // are drawn fresh so the same set never repeats inside a run.
    if (clearedLevel && !isFinalLevel) {
      const alreadyUsed = await tx.sessionQuestion.findMany({ where: { sessionId }, select: { questionId: true } });
      const drawn = await drawLevelQuestions(tx, nextLevel, QUESTIONS_PER_LEVEL, alreadyUsed.map((item) => item.questionId));
      const startOrder = session.questions.reduce((max, item) => Math.max(max, item.order), -1) + 1;
      await tx.sessionQuestion.createMany({ data: drawn.map((item, index) => ({ ...item, sessionId, order: startOrder + index })) });
      // Per-question lifelines for the new level's questions.
      const newRows = await tx.sessionQuestion.findMany({ where: { sessionId, order: { gte: startOrder } }, select: { id: true } });
      const perQuestion = session.game.gameLifelines.filter((item) => item.scope === 'QUESTION');
      if (perQuestion.length && newRows.length) {
        await tx.quizSessionLifeline.createMany({
          data: perQuestion.flatMap((item) => newRows.map((row) => ({ sessionId, type: item.type as never, cost: item.cost, questionId: row.id }))),
          skipDuplicates: true,
        });
      }
    }

    /**
     * Re-read the pending question from the database rather than trusting the
     * in-memory snapshot: clearing a level appends the next level's questions,
     * so the last question of a cleared level has no successor in `session`.
     * Without this the client was left with no question to show.
     */
    const pending = gameOver ? undefined : await tx.sessionQuestion.findFirst({
      where: { sessionId, answeredAt: null, skippedAt: null },
      orderBy: { order: 'asc' },
      include: sessionQuestionInclude,
    });
    const next = pending ? publicQuestion(pending) : undefined;

    await tx.quizSession.update({
      where: { id: sessionId },
      data: {
        score: sessionScore,
        currentLevel: nextLevel,
        currentCombo: combo,
        bestCombo: Math.max(session.bestCombo, combo),
        currentQuestionOrder: session.currentQuestionOrder + 1,
        status,
        ...(status === 'COMPLETED' ? { completedAt: new Date(), abandonedAt: null } : {}),
      },
    });
    if (points) await applyPointChange(tx, { userId, amount: points, type: 'EARN_QUIZ', description: 'Correct quiz answer', sourceType: 'QUIZ_ANSWER', sourceId: sq.id, idempotencyKey: `quiz-answer:${sq.id}`, sessionId });
    await updateMissions(tx, userId, 'QUESTION_ANSWERED', 1);
    if (isCorrect) await updateMissions(tx, userId, 'CORRECT_ANSWER', 1);
    const achievements = await evaluateAchievements(tx, userId);
    if (status === 'COMPLETED') await tx.user.update({ where: { id: userId }, data: { totalGames: { increment: 1 } } });

    const won = status === 'COMPLETED' && !gameOver;
    return {
      correct: isCorrect,
      skipped: false,
      protectedBySecondChance,
      gameOver,
      reason: gameOver ? ('WRONG' as const) : won ? ('COMPLETED' as const) : null,
      /** The whole ladder was cleared with no wrong answer. */
      completedRun: won,
      correctAnswerId: sq.question.answers.find((answer) => answer.isCorrect)!.id,
      explanation: sq.question.explanation,
      pointsEarned: points,
      pointsAwarded: points,
      totalPoints: sessionScore,
      userPoints: stats.points,
      stats: { correctAnswers: stats.correctAnswers, wrongAnswers: stats.wrongAnswers },
      achievements,
      level: session.currentLevel,
      levelName: sq.question.level?.name ?? null,
      levelPointsPerAnswer: pointsForLevel(session.currentLevel),
      /** 10/10 reached: the run moves on to the next level. */
      levelCleared: clearedLevel,
      levelAdvanced: clearedLevel && !isFinalLevel,
      nextLevel: clearedLevel && !isFinalLevel ? nextLevel : undefined,
      scoreBeforeReset: gameOver ? session.score : undefined,
      resetScore: gameOver ? session.score : undefined,
      nextQuestion: next ?? null,
      completed: status === 'COMPLETED',
      game: {
        id: session.id,
        gameId: session.gameId,
        status,
        level: nextLevel,
        levelName: sq.question.level?.name ?? null,
        currentQuestion: next ?? null,
        questionNumber: session.currentQuestionOrder + 1,
        levelAnswered: Math.min(levelCorrect, QUESTIONS_PER_LEVEL),
        levelCorrect,
        levelQuestions: QUESTIONS_PER_LEVEL,
        score: sessionScore,
        points: sessionScore,
        earnedPoints: sessionScore,
        totalQuestions: TOTAL_QUESTIONS,
        questionsPerLevel: QUESTIONS_PER_LEVEL,
        maxLevels: MAX_LEVELS,
        maxScore: TOTAL_MAX_POINTS,
        levelLadder: LEVEL_LADDER,
      },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function finishGame(userId: string, sessionId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.quizSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw ApiError.notFound('Quiz game not found');
    if (session.status !== 'IN_PROGRESS') return session;
    const unanswered = await tx.sessionQuestion.count({ where: { sessionId, answeredAt: null, skippedAt: null } });
    const updated = await tx.quizSession.update({ where: { id: sessionId }, data: { status: unanswered ? 'ABANDONED' : 'COMPLETED', completedAt: unanswered ? null : new Date(), abandonedAt: unanswered ? new Date() : null } });
    if (!unanswered) {
      await tx.user.update({ where: { id: userId }, data: { totalGames: { increment: 1 } } });
      await evaluateAchievements(tx, userId);
    }
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
