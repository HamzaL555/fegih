import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../config/prisma-client.js';

const { prismaMock, applyPointChangeMock, updateMissionsMock, evaluateAchievementsMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
  applyPointChangeMock: vi.fn(async () => undefined),
  updateMissionsMock: vi.fn(async () => undefined),
  evaluateAchievementsMock: vi.fn(async () => []),
}));

vi.mock('../../config/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../achievements/service.js', () => ({ evaluateAchievements: evaluateAchievementsMock }));
vi.mock('../missions/service.js', () => ({ updateMissions: updateMissionsMock }));
vi.mock('../rewards/points.js', () => ({ applyPointChange: applyPointChangeMock }));

import { answerQuestion, finishGame } from './service.js';

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    gameId: 'game-1',
    status: 'IN_PROGRESS',
    expiresAt: null,
    currentLevel: 1,
    score: 0,
    currentCombo: 0,
    bestCombo: 0,
    currentQuestionOrder: 0,
    game: { gameLifelines: [] },
    questions: [{
      id: 'sq-1',
      questionId: 'question-1',
      pointValue: 1,
      displayedAt: null,
      answer: null,
      skippedAt: null,
      lifelines: [],
      question: {
        id: 'question-1',
        explanation: 'Because',
        level: { name: 'Level 1', position: 1 },
        answers: [
          { id: 'answer-correct', isCorrect: true },
          { id: 'answer-wrong', isCorrect: false },
        ],
      },
    }],
    ...overrides,
  };
}

function createTx() {
  return {
    quizSession: { findFirst: vi.fn(), update: vi.fn(async () => ({})) },
    sessionQuestion: {
      update: vi.fn(),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      createMany: vi.fn(),
      count: vi.fn(async () => 0),
    },
    quizSessionAnswer: {
      create: vi.fn(async () => ({})),
      count: vi.fn(async () => 1),
    },
    user: { update: vi.fn(async () => ({ correctAnswers: 1, wrongAnswers: 0, points: 1 })) },
    quizSessionLifeline: { createMany: vi.fn() },
  };
}

function run(tx: ReturnType<typeof createTx>) {
  prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
}

describe('answerQuestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a correct answer and awards the level points', async () => {
    const tx = createTx();
    tx.quizSession.findFirst.mockResolvedValue(session());
    tx.quizSessionAnswer.count.mockResolvedValue(1);
    run(tx);

    const result = await answerQuestion('user-1', 'session-1', 'question-1', 'answer-correct');

    expect(result.correct).toBe(true);
    expect(result.gameOver).toBe(false);
    expect(result.pointsEarned).toBe(1);
    expect(result.totalPoints).toBe(1);
    expect(tx.quizSessionAnswer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sessionQuestionId: 'sq-1', selectedAnswerId: 'answer-correct', isCorrect: true, pointsAwarded: 1 }),
    }));
    expect(applyPointChangeMock).toHaveBeenCalledWith(tx, expect.objectContaining({ amount: 1 }));
  });

  it('ends the run and resets the score on a wrong answer', async () => {
    const tx = createTx();
    tx.quizSession.findFirst.mockResolvedValue(session({ score: 5 }));
    tx.quizSessionAnswer.count.mockResolvedValue(0);
    tx.user.update.mockResolvedValue({ correctAnswers: 0, wrongAnswers: 1, points: 5 });
    run(tx);

    const result = await answerQuestion('user-1', 'session-1', 'question-1', 'answer-wrong');

    expect(result.correct).toBe(false);
    expect(result.gameOver).toBe(true);
    expect(result.reason).toBe('WRONG');
    expect(result.totalPoints).toBe(0);
    expect(result.scoreBeforeReset).toBe(5);
    expect(tx.quizSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ score: 0, status: 'COMPLETED' }),
    }));
    expect(applyPointChangeMock).toHaveBeenCalledWith(tx, expect.objectContaining({ amount: -5 }));
  });

  it('rejects a second answer for an already answered question with 409', async () => {
    const tx = createTx();
    const answered = session();
    answered.questions[0]!.answer = { id: 'existing-answer' } as never;
    tx.quizSession.findFirst.mockResolvedValue(answered);
    run(tx);

    await expect(answerQuestion('user-1', 'session-1', 'question-1', 'answer-correct')).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
    expect(tx.quizSessionAnswer.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate-key race to 409 using the database unique key', async () => {
    const tx = createTx();
    tx.quizSession.findFirst.mockResolvedValue(session());
    tx.quizSessionAnswer.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.19.0',
      meta: { target: ['sessionQuestionId'] },
    }));
    run(tx);

    await expect(answerQuestion('user-1', 'session-1', 'question-1', 'answer-correct')).rejects.toMatchObject({
      status: 409,
      message: 'Bu sual artıq cavablandırılıb',
    });
  });

  it('returns 409 when the question has no correct answer variant', async () => {
    const tx = createTx();
    const broken = session();
    broken.questions[0]!.question.answers = [{ id: 'answer-wrong', isCorrect: false }];
    tx.quizSession.findFirst.mockResolvedValue(broken);
    run(tx);

    await expect(answerQuestion('user-1', 'session-1', 'question-1', 'answer-wrong')).rejects.toMatchObject({
      status: 409,
      message: 'Bu sual üçün düzgün cavab variantı təyin edilməyib',
    });
  });
});

describe('finishGame', () => {
  beforeEach(() => vi.clearAllMocks());

  it('completes the game when no questions are unanswered', async () => {
    const tx = createTx();
    tx.quizSession.findFirst.mockResolvedValue({ id: 'session-1', userId: 'user-1', status: 'IN_PROGRESS' });
    tx.sessionQuestion.count.mockResolvedValue(0);
    tx.quizSession.update.mockResolvedValue({ id: 'session-1', status: 'COMPLETED' });
    run(tx);

    const result = await finishGame('user-1', 'session-1');

    expect(result.status).toBe('COMPLETED');
    expect(tx.quizSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED', abandonedAt: null }),
    }));
    expect(tx.user.update).toHaveBeenCalled();
    expect(evaluateAchievementsMock).toHaveBeenCalledWith(tx, 'user-1');
  });

  it('abandons the game when questions remain unanswered', async () => {
    const tx = createTx();
    tx.quizSession.findFirst.mockResolvedValue({ id: 'session-1', userId: 'user-1', status: 'IN_PROGRESS' });
    tx.sessionQuestion.count.mockResolvedValue(3);
    tx.quizSession.update.mockResolvedValue({ id: 'session-1', status: 'ABANDONED' });
    run(tx);

    const result = await finishGame('user-1', 'session-1');

    expect(result.status).toBe('ABANDONED');
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(evaluateAchievementsMock).not.toHaveBeenCalled();
  });

  it('returns an already finished game without writing again', async () => {
    const tx = createTx();
    tx.quizSession.findFirst.mockResolvedValue({ id: 'session-1', userId: 'user-1', status: 'COMPLETED' });
    run(tx);

    const result = await finishGame('user-1', 'session-1');

    expect(result.status).toBe('COMPLETED');
    expect(tx.quizSession.update).not.toHaveBeenCalled();
  });
});
