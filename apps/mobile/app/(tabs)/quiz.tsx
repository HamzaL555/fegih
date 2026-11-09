import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Linking, Pressable } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ListRow } from '@/components/ListRow';
import { RemoteState } from '@/components/RemoteState';
import { questionsApi, quizApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import type { AnswerResult, EntityId, Question, QuizGame } from '@/types/domain';

type LifelineType = 'FIFTY_FIFTY' | 'SECOND_CHANCE' | 'SKIP' | 'EXTRA_TIME' | 'HINT';

const points = (value: number | undefined) => new Intl.NumberFormat('az-AZ').format(value ?? 0);

interface LifelineEffect {
  type?: LifelineType;
  eliminatedAnswerIds?: EntityId[];
  hint?: string;
  extraSeconds?: number;
  armedForQuestionId?: EntityId;
}

const LIFELINE_LABELS: Record<LifelineType, string> = {
  FIFTY_FIFTY: 'quiz.lifeline5050',
  SECOND_CHANCE: 'quiz.lifelineSecondChance',
  SKIP: 'quiz.lifelineSkip',
  EXTRA_TIME: 'quiz.lifelineExtraTime',
  HINT: 'quiz.lifelineHint',
};

function currentQuestion(game: QuizGame | null): Question | undefined {
  return game?.currentQuestion ?? game?.question;
}

/**
 * The session id, NOT `gameId`. Every quiz mutation addresses the *session*;
 * preferring `gameId` (a foreign key to the game configuration) made the very
 * first answer 404 with "Quiz game not found".
 */
function sessionId(game: QuizGame | null): EntityId | undefined {
  return game?.id;
}

export default function QuizScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const isSignedIn = authStatus === 'authenticated';

  const [game, setGame] = useState<QuizGame | null>(null);
  /** Kept so a restart can ask the server for *different* questions. */
  const [lastSessionId, setLastSessionId] = useState<EntityId>();
  const [selectedAnswerId, setSelectedAnswerId] = useState<EntityId>();
  const [answerResult, setAnswerResult] = useState<AnswerResult>();
  const [lifelineEffect, setLifelineEffect] = useState<LifelineEffect>();
  const [formError, setFormError] = useState<unknown>();
  const [actionError, setActionError] = useState<unknown>();
  /** A wrong answer ends the run: score back to 0, restart at level 1. */
  const [gameOver, setGameOver] = useState(false);
  const [scoreAtEnd, setScoreAtEnd] = useState(0);
  const [levelAtEnd, setLevelAtEnd] = useState(1);
  const [won, setWon] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>();

  const questionsQuery = useRemoteQuery({
    queryKey: ['questions', 'quiz-bank'],
    queryFn: () => questionsApi.list({ page: 1, limit: 1 }),
    enabled: isSignedIn,
  });

  const question = currentQuestion(game);

  // Per-question countdown. The server enforces the session limit; this makes
  // the per-question budget visible to the player.
  useEffect(() => {
    const limit = question?.timeLimitSeconds;
    if (!limit || answerResult) {
      setSecondsLeft(undefined);
      return;
    }
    setSecondsLeft(limit);
    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current === undefined) return undefined;
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [question?.id, question?.timeLimitSeconds, answerResult]);

  const startMutation = useMutation({
    mutationFn: (excludeSessionId?: EntityId) => quizApi.start(excludeSessionId ? { excludeSessionId } : {}),
    onSuccess: (nextGame) => {
      setGame(nextGame);
      setLastSessionId(nextGame.id);
      setSelectedAnswerId(undefined);
      setAnswerResult(undefined);
      setLifelineEffect(undefined);
      setFormError(undefined);
      setActionError(undefined);
      setGameOver(false);
      setWon(false);
      setScoreAtEnd(0);
      setLevelAtEnd(1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: setFormError,
  });

  const answerMutation = useMutation({
    mutationFn: (answerId: EntityId) => {
      const id = sessionId(game);
      if (!id) throw new Error(t('quiz.noActiveGame'));
      // The client submits only the selected option ID. Correctness and
      // points are always decided and returned by the API.
      return quizApi.answer(id, { answerId });
    },
    onSuccess: (result) => {
      setAnswerResult(result);
      setLifelineEffect(undefined);
      if (result.gameOver) {
        setGameOver(true);
        setWon(!!result.completedRun);
        setScoreAtEnd(result.totalPoints ?? 0);
        setLevelAtEnd(result.level ?? game?.level ?? 1);
      }
      // `result.game` is a partial snapshot. Replacing the whole state with it
      // wiped `availableLifelines` and `expiresAt` after the first question.
      if (result.game) setGame((current) => (current ? { ...current, ...result.game } : result.game as QuizGame));
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      void Haptics.notificationAsync(result.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    },
    onError: setActionError,
  });

  const finishMutation = useMutation({
    mutationFn: () => {
      const id = sessionId(game);
      if (!id) throw new Error(t('quiz.noActiveGame'));
      return quizApi.finish(id);
    },
    onSuccess: (finishedGame) => {
      setGame((current) => (current ? { ...current, ...finishedGame } : finishedGame));
      setAnswerResult(undefined);
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
    },
    onError: setActionError,
  });

  const lifelineMutation = useMutation({
    mutationFn: (type: LifelineType) => {
      const id = sessionId(game);
      if (!id) throw new Error(t('quiz.noActiveGame'));
      return quizApi.useLifeline(id, { type });
    },
    onSuccess: (result) => {
      // The response carries the full game state plus the lifeline's effect
      // (eliminated options, hint, extra seconds). Discarding the effect made
      // every lifeline look like it did nothing.
      setGame((current) => (current ? { ...current, ...result } : (result as QuizGame)));
      setAnswerResult(undefined);
      setSelectedAnswerId(undefined);
      setLifelineEffect(result as LifelineEffect);
      setActionError(undefined);
      if (result.extraSeconds) setSecondsLeft((current) => (current ?? 0) + result.extraSeconds!);
      // Using Skip ends the run: a skipped question can never be part of a
      // 10/10 level, so the score is reset to 0.
      if (result.status !== 'IN_PROGRESS') {
        setGameOver(true);
        setScoreAtEnd(0);
        setLevelAtEnd(game?.level ?? 1);
      }
    },
    onError: setActionError,
  });

  const id = sessionId(game);
  const hasStarted = !!game;
  // Once the game is over the next question is never shown, even if the server
  // still has unanswered rows.
  const canShowNext = !gameOver && (!!answerResult?.nextQuestion || !!answerResult?.game?.currentQuestion);

  const start = useCallback(() => {
    setFormError(undefined);
    setActionError(undefined);
    // After a loss the previous run's questions are excluded so the retry
    // really does serve a different set.
    startMutation.mutate(gameOver ? lastSessionId : undefined);
  }, [gameOver, lastSessionId, startMutation]);

  const submitAnswer = useCallback(() => {
    setActionError(undefined);
    if (!selectedAnswerId) {
      setActionError(new Error(t('quiz.selectAnswer')));
      return;
    }
    answerMutation.mutate(selectedAnswerId);
  }, [answerMutation, selectedAnswerId, t]);

  // Time ran out: skip the question instead of freezing the screen.
  useEffect(() => {
    if (secondsLeft !== 0 || answerResult || !question) return;
    const current = sessionId(game);
    if (!current) return;
    setActionError(new Error(t('quiz.timeUp')));
    void quizApi.answer(current, { answerId: null, skipped: true }).catch(() => undefined);
  }, [secondsLeft, answerResult, game, question, t]);

  const nextQuestion = () => {
    setAnswerResult(undefined);
    setSelectedAnswerId(undefined);
    setLifelineEffect(undefined);
  };

  if (!isSignedIn) {
    return (
      <AppScreen title={t('quiz.title')} subtitle={t('quiz.subtitle')}>
        <Card>
          <AppText variant="subtitle">{t('auth.signInRequired')}</AppText>
          <Button label={t('common.signIn')} onPress={() => setFormError(new Error(t('auth.signInRequired')))} />
        </Card>
        {formError ? <ErrorBanner error={formError} onDismiss={() => setFormError(undefined)} /> : null}
      </AppScreen>
    );
  }

  const eliminated = new Set(lifelineEffect?.eliminatedAnswerIds ?? []);
  const perLevel = game?.questionsPerLevel ?? 10;
  const levelCorrect = answerResult?.levelAdvanced ? perLevel : game?.levelCorrect ?? 0;
  const clearedLevels = Math.max(0, (game?.level ?? 1) - 1);

  return (
    <AppScreen title={t('quiz.title')} subtitle={t('quiz.subtitle')}>
      <RemoteState
        isLoading={questionsQuery.isPending}
        isError={questionsQuery.isError}
        error={questionsQuery.error}
        isEmpty={questionsQuery.data?.data.length === 0}
        onRetry={() => void questionsQuery.refetch()}
        loadingLabel={t('quiz.loadingGame')}
        emptyTitle={t('quiz.noQuiz')}
        emptyDescription={t('quiz.questionUnavailable')}
      >
        {!hasStarted ? (
          <Card>
            <AppText variant="title" color={colors.primary} style={styles.gameTitle}>{t('quiz.sualCavab')}</AppText>
            <AppText color={colors.textMuted} style={styles.body}>{t('quiz.sualCavabSubtitle')}</AppText>
            <View style={styles.rules}>
              {[
                t('quiz.ruleLevels'),
                t('quiz.rulePoints'),
                t('quiz.ruleReset'),
              ].map((rule) => (
                <AppText key={rule} color={colors.textMuted}>• {rule}</AppText>
              ))}
            </View>
            {formError ? <ErrorBanner error={formError} onDismiss={() => setFormError(undefined)} /> : null}
            <Button label={t('quiz.start')} onPress={start} loading={startMutation.isPending} />
          </Card>
        ) : (
          <View>
            {!question || gameOver ? (
              <Card>
                <AppText variant="title" color={won ? colors.success : gameOver ? colors.danger : colors.text}>
                  {won ? t('quiz.completedRun') : gameOver ? t('quiz.runOver') : t('quiz.gameFinished')}
                </AppText>
                <AppText color={colors.textMuted} style={styles.resultText}>
                  {won ? t('quiz.completedRunHint') : gameOver ? t('quiz.runOverHint') : t('quiz.finishedHint')}
                </AppText>
                <AppText variant="title" color={colors.primary} style={styles.score}>
                  {t('quiz.score')}: {points(scoreAtEnd)} / {points(game?.maxScore ?? 1200)}
                </AppText>
                <AppText color={colors.textMuted}>
                  {t('quiz.reachedLevel')}: {levelAtEnd} / {game?.maxLevels ?? 15}
                </AppText>
                {game?.correctAnswers !== undefined ? (
                  <AppText color={colors.textMuted}>
                    {t('quiz.correctCount')}: {game.correctAnswers}
                  </AppText>
                ) : null}
                <Button label={t('quiz.playAgain')} onPress={start} variant="secondary" loading={startMutation.isPending} style={styles.action} />
              </Card>
            ) : (
              <Card>
                {/* Score + current level. */}
                <View style={styles.scoreHeader}>
                  <View>
                    <AppText variant="caption" color={colors.textMuted}>{t('quiz.score')}</AppText>
                    <AppText variant="title" color={colors.primary}>{points(game?.score ?? 0)}</AppText>
                  </View>
                  <View style={styles.levelHeader}>
                    <AppText variant="caption" color={colors.textMuted}>{t('quiz.level')}</AppText>
                    <AppText variant="title" color={colors.primary}>{game?.level ?? 1}</AppText>
                  </View>
                </View>
                {game?.levelName ? (
                  <AppText variant="caption" color={colors.textMuted} style={styles.levelName}>
                    {t('quiz.levelName', { level: game.level, name: game.levelName })}
                  </AppText>
                ) : null}
                {/* 10 pips: filled = correct so far in this level. */}
                <View style={styles.pips}>
                  {Array.from({ length: perLevel }, (_, index) => {
                    const done = index < levelCorrect;
                    return (
                      <View
                        key={index}
                        style={[styles.pip, { backgroundColor: done ? colors.success : colors.surfaceElevated, borderColor: done ? colors.success : colors.border }]}
                      />
                    );
                  })}
                </View>
                <AppText variant="caption" color={colors.textMuted}>
                  {t('quiz.levelProgress', { correct: levelCorrect, total: perLevel, points: game?.levelPointsPerAnswer ?? game?.level ?? 1 })}
                </AppText>

                {/* 15 level rungs, current one highlighted. */}
                <View style={styles.ladder}>
                  {(game?.levelLadder ?? []).map((rung) => {
                    const done = rung.level <= clearedLevels;
                    const current = rung.level === (game?.level ?? 1);
                    return (
                      <View
                        key={rung.level}
                        style={[
                          styles.rung,
                          {
                            backgroundColor: current ? colors.primary : done ? colors.surfaceElevated : 'transparent',
                            borderColor: current ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <AppText variant="caption" color={current ? colors.primaryContrast : colors.textMuted}>{rung.level}</AppText>
                        <AppText variant="label" color={current ? colors.primaryContrast : done ? colors.success : colors.text}>
                          {points(rung.maxPoints)}
                        </AppText>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.questionHeader}>
                  <AppText variant="label" color={colors.primary}>
                    {t('quiz.questionOf', { current: game?.questionNumber ?? 1, total: game?.totalQuestions ?? 150 })}
                  </AppText>
                  {secondsLeft !== undefined ? (
                    <AppText variant="label" color={secondsLeft <= 5 ? colors.danger : colors.textMuted}>
                      ⏱ {secondsLeft}s
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="title" style={styles.prompt}>{question.prompt}</AppText>
                {lifelineEffect?.hint ? (
                  <View style={[styles.hint, { backgroundColor: colors.surfaceElevated }]}>
                    <AppText variant="label" color={colors.secondary}>💡 {t('quiz.lifelineHint')}</AppText>
                    <AppText color={colors.textMuted}>{lifelineEffect.hint}</AppText>
                  </View>
                ) : null}
                <View style={styles.options}>
                  {question.options.map((option) => {
                    const isSelected = selectedAnswerId === option.id;
                    const isEliminated = eliminated.has(option.id);
                    const isCorrectAnswer = answerResult?.correctAnswerId === option.id;
                    const showCorrect = !!answerResult && isCorrectAnswer;
                    return (
                      <ListRow
                        key={option.id}
                        onPress={() => { if (!answerResult && !isEliminated) setSelectedAnswerId(option.id); }}
                        style={[
                          isSelected ? { borderColor: colors.primary } : undefined,
                          isEliminated ? styles.eliminated : undefined,
                          showCorrect ? { borderColor: colors.success } : undefined,
                        ]}
                      >
                        <AppText color={showCorrect ? colors.success : isEliminated ? colors.textMuted : isSelected ? colors.primary : colors.text}>
                          {isEliminated ? '✕ ' : ''}{option.text}
                        </AppText>
                      </ListRow>
                    );
                  })}
                </View>
                {answerResult ? (
                  <View style={[styles.result, { backgroundColor: colors.surfaceElevated }]}>
                    <AppText variant="label" color={answerResult.correct ? colors.success : colors.danger}>
                      {answerResult.correct ? t('quiz.correct') : answerResult.skipped ? t('quiz.skipped') : t('quiz.incorrect')}
                    </AppText>
                    {answerResult.levelAdvanced ? (
                      <AppText color={colors.success}>
                        {t('quiz.levelCleared', { level: answerResult.nextLevel, points: answerResult.levelPointsPerAnswer })}
                      </AppText>
                    ) : null}
                    {answerResult.pointsCommitted ? (
                      <AppText color={colors.success}>
                        {t('quiz.levelReward', { points: answerResult.pointsCommitted })}
                      </AppText>
                    ) : answerResult.correct && answerResult.pointsAwarded ? (
                      <AppText color={colors.textMuted}>
                        {t('quiz.temporaryPoints', { points: answerResult.pointsAwarded })}
                      </AppText>
                    ) : null}
                    {answerResult.gameOver && !answerResult.completedRun ? (
                      <AppText color={colors.danger}>
                        {t('quiz.scoreReset', { lost: points(answerResult.scoreBeforeReset) })}
                      </AppText>
                    ) : null}
                    {answerResult.explanation ? <AppText color={colors.textMuted}>{answerResult.explanation}</AppText> : null}
                    {answerResult.reference?.source ? (
                      <Pressable
                        accessibilityRole={answerResult.reference.sourceUrl ? 'link' : undefined}
                        disabled={!answerResult.reference.sourceUrl}
                        onPress={() => {
                          if (answerResult.reference?.sourceUrl) void Linking.openURL(answerResult.reference.sourceUrl);
                        }}
                      >
                        <AppText color={colors.primary}>
                          {t('quiz.reference', { source: answerResult.reference.source })}
                        </AppText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {actionError ? <ErrorBanner error={actionError} onDismiss={() => setActionError(undefined)} /> : null}
                {answerResult ? (
                  canShowNext ? (
                    <Button label={t('quiz.nextQuestion')} onPress={nextQuestion} variant="secondary" style={styles.action} />
                  ) : answerResult.gameOver ? null : (
                    <Button label={t('quiz.finish')} onPress={() => finishMutation.mutate()} loading={finishMutation.isPending} style={styles.action} />
                  )
                ) : (
                  <Button label={t('quiz.submitAnswer')} onPress={submitAnswer} loading={answerMutation.isPending} style={styles.action} />
                )}
              </Card>
            )}

            <ScreenSection>
              <AppText variant="subtitle" style={styles.sectionTitle}>{t('quiz.lifelines')}</AppText>
              <View style={styles.lifelines}>
                {(game?.availableLifelines ?? []).map((type) => (
                  <Button
                    key={type}
                    label={t(LIFELINE_LABELS[type as LifelineType] ?? 'quiz.lifelines')}
                    onPress={() => lifelineMutation.mutate(type as LifelineType)}
                    variant="secondary"
                    loading={lifelineMutation.isPending}
                    style={styles.lifeline}
                  />
                ))}
              </View>
              {/* Lifelines already spent are listed as used so it is clear why
                  a button disappeared — a per-question lifeline (skip, extra
                  time) comes back on the next question, 50/50 does not. */}
              {gameOver || !question ? null : (game?.spentLifelines ?? []).length ? (
                <AppText variant="caption" color={colors.textMuted} style={styles.spent}>
                  {t('quiz.spentLifelines')}: {(game?.spentLifelines ?? []).map((type) => t(LIFELINE_LABELS[type as LifelineType] ?? type)).join(', ')}
                </AppText>
              ) : null}
            </ScreenSection>
          </View>
        )}
      </RemoteState>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  gameTitle: { textAlign: 'center', marginBottom: 6 },
  body: { textAlign: 'center', marginBottom: 12 },
  rules: { gap: 4, marginBottom: 16 },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  levelHeader: { alignItems: 'flex-end' },
  levelName: { marginTop: 2 },
  pips: { flexDirection: 'row', gap: 4, marginTop: 12, marginBottom: 6 },
  pip: { flex: 1, height: 6, borderRadius: 3, borderWidth: 1 },
  ladder: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 14, marginBottom: 16 },
  rung: { minWidth: 60, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 9, borderWidth: 1, alignItems: 'center' },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prompt: { marginVertical: 18 },
  options: { marginBottom: 14, gap: 2 },
  result: { borderRadius: 14, padding: 12, gap: 6 },
  hint: { borderRadius: 14, padding: 12, gap: 4, marginBottom: 12 },
  eliminated: { opacity: 0.45 },
  action: { marginTop: 14 },
  sectionTitle: { marginBottom: 10 },
  lifelines: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lifeline: { flexGrow: 1, minWidth: 120 },
  spent: { marginTop: 8 },
  score: { marginVertical: 10 },
  resultText: { marginBottom: 12 },
});
