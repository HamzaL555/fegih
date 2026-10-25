import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ListRow } from '@/components/ListRow';
import { RemoteState } from '@/components/RemoteState';
import { TextField } from '@/components/TextField';
import { tasbeehApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import type { EntityId, TasbeehSession } from '@/types/domain';

const PRESETS = [
  { name: 'Subhanallah', target: 33 },
  { name: 'Alhamdulillah', target: 33 },
  { name: 'Allahu Akbar', target: 34 },
  { name: 'La ilaha illallah', target: 100 },
];

export default function TasbeehScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [selectedId, setSelectedId] = useState<EntityId>();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<unknown>();
  const [success, setSuccess] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const query = useRemoteQuery({ queryKey: ['tasbeeh', 'sessions'], queryFn: () => tasbeehApi.sessions({ page: 1, limit: 50 }), staleTime: 60_000 });
  const sessions = query.data?.data ?? [];
  const active = sessions.find((session) => session.id === selectedId) ?? sessions[0];

  /**
   * The counter is local-first: a tap updates the number immediately and the
   * delta is flushed to the API. Waiting for a round trip per tap (the previous
   * behaviour) made the counter unusable and left the UI disabled while saving.
   */
  const [localCount, setLocalCount] = useState<number>();
  const pendingDelta = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!selectedId && sessions[0]) setSelectedId(sessions[0].id);
  }, [selectedId, sessions]);

  useEffect(() => {
    // Adopt the server value whenever the active session or a refetch changes,
    // unless local taps are still waiting to be flushed.
    if (!active) return;
    if (pendingDelta.current === 0) setLocalCount(active.currentCount);
  }, [active?.id, active?.currentCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async (sessionId: EntityId) => {
    if (pendingDelta.current === 0) return;
    const delta = pendingDelta.current;
    pendingDelta.current = 0;
    try {
      const session = await tasbeehApi.addCount(sessionId, { count: delta });
      setLocalCount(session.currentCount);
      await query.refetch();
    } catch (requestError) {
      // Put the taps back so they are retried on the next one.
      pendingDelta.current += delta;
      setError(requestError);
    }
  }, [query]);

  useEffect(() => () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
  }, []);

  const count = localCount ?? active?.currentCount ?? 0;
  const targetCount = active?.targetCount ?? 0;
  const remaining = Math.max(0, targetCount - count);
  const progress = targetCount > 0 ? Math.min(1, count / targetCount) : 0;

  const increment = () => {
    if (!active) return;
    if (count >= targetCount) return;
    setLocalCount(count + 1);
    pendingDelta.current += 1;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => void flush(active.id), 600);
  };

  const createSession = async (preset?: { name: string; target: number }) => {
    setSaving(true);
    setError(undefined);
    try {
      const session = await tasbeehApi.createSession({
        name: preset?.name ?? (name.trim() || undefined),
        target: preset?.target ?? (Number.isFinite(Number(target)) && Number(target) > 0 ? Number(target) : undefined),
      });
      pendingDelta.current = 0;
      setLocalCount(session.currentCount);
      setSelectedId(session.id);
      setName('');
      setTarget('');
      setSuccess(t('tasbeeh.sessionCreated'));
      await query.refetch();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!active) return;
    setBusy(true);
    setError(undefined);
    try {
      const session = await tasbeehApi.reset(active.id);
      pendingDelta.current = 0;
      setLocalCount(session.currentCount);
      setSuccess(t('tasbeeh.resetDone'));
      await query.refetch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!active) return;
    setBusy(true);
    setError(undefined);
    try {
      await tasbeehApi.remove(active.id);
      setSelectedId(undefined);
      setLocalCount(undefined);
      setSuccess(t('tasbeeh.sessionDeleted'));
      await query.refetch();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen title={t('tasbeeh.title')} subtitle={t('tasbeeh.subtitle')} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <RemoteState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        isEmpty={sessions.length === 0}
        onRetry={() => void query.refetch()}
        emptyTitle={t('tasbeeh.noSessions')}
        emptyDescription={t('common.empty')}
      >
        {active ? (
          <Card style={styles.counterCard}>
            <AppText variant="label" color={colors.textMuted}>{active.name || t('tasbeeh.active')}</AppText>
            <View style={styles.dial}>
              <View style={[styles.dialTrack, { borderColor: colors.border }]}>
                <View style={[styles.dialProgress, { borderColor: colors.primary, transform: [{ rotate: `${-90 + progress * 360}deg` }] }]} />
              </View>
              <AppText variant="display" color={colors.primary} style={styles.dialValue}>{count}</AppText>
              <AppText variant="caption" color={colors.textMuted}>{t('tasbeeh.target')}: {targetCount}</AppText>
            </View>
            <Pressable
              onPress={increment}
              disabled={count >= targetCount}
              accessibilityRole="button"
              accessibilityLabel={t('tasbeeh.addCount')}
              style={({ pressed }) => [styles.tapButton, { backgroundColor: count >= targetCount ? colors.surfaceElevated : colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <AppText variant="title" color={count >= targetCount ? colors.textMuted : colors.primaryContrast}>{t('tasbeeh.tapToCount')}</AppText>
            </Pressable>
            <AppText variant="caption" color={colors.textMuted} style={styles.remaining}>
              {count >= targetCount ? `🎉 ${t('tasbeeh.completed')}` : `${t('tasbeeh.remaining')}: ${remaining}`}
            </AppText>
            <View style={styles.counterActions}>
              <Button label={t('tasbeeh.reset')} onPress={() => void reset()} variant="secondary" loading={busy} style={styles.actionButton} />
              <Button label={t('common.remove')} onPress={() => void remove()} variant="ghost" loading={busy} style={styles.actionButton} />
            </View>
          </Card>
        ) : null}
      </RemoteState>

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('tasbeeh.presets')}</AppText>
        <View style={styles.presets}>
          {PRESETS.map((preset) => (
            <Pressable key={preset.name} onPress={() => void createSession(preset)} style={({ pressed }) => [styles.preset, { backgroundColor: pressed ? colors.surfaceElevated : colors.surface, borderColor: colors.border }]}>
              <AppText variant="subtitle">{preset.name}</AppText>
              <AppText variant="caption" color={colors.textMuted}>{preset.target}</AppText>
            </Pressable>
          ))}
        </View>
      </ScreenSection>

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('tasbeeh.newSession')}</AppText>
        <Card>
          <TextField label={t('tasbeeh.sessionName')} placeholder={t('tasbeeh.nameOptional')} value={name} onChangeText={setName} />
          <TextField label={t('tasbeeh.target')} placeholder="33" value={target} onChangeText={setTarget} keyboardType="number-pad" />
          {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
          {success ? <AppText color={colors.success} style={styles.success}>{success}</AppText> : null}
          <Button label={t('tasbeeh.startSession')} onPress={() => void createSession()} loading={saving} />
        </Card>
      </ScreenSection>

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('tasbeeh.sessions')}</AppText>
        <Card style={styles.sessionList}>
          {sessions.map((session: TasbeehSession) => (
            <ListRow key={session.id} onPress={() => { setSelectedId(session.id); setLocalCount(session.currentCount); }}>
              <View style={styles.sessionText}>
                <AppText variant={session.id === active?.id ? 'subtitle' : 'body'} color={session.id === active?.id ? colors.primary : colors.text}>{session.name || t('tasbeeh.active')}</AppText>
                <AppText variant="caption" color={colors.textMuted}>{session.currentCount} / {session.targetCount}</AppText>
              </View>
              {session.completed || session.status === 'COMPLETED' ? <AppText variant="caption" color={colors.success}>✓</AppText> : null}
            </ListRow>
          ))}
        </Card>
      </ScreenSection>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  counterCard: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  dial: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  dialTrack: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 10 },
  dialProgress: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 10, borderLeftColor: 'transparent', borderBottomColor: 'transparent' },
  dialValue: { fontSize: 64, lineHeight: 72 },
  tapButton: { marginTop: 16, minHeight: 84, minWidth: 220, borderRadius: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  remaining: { marginTop: 4, textAlign: 'center' },
  counterActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: { flex: 1 },
  sectionTitle: { marginBottom: 10 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, minWidth: 140 },
  success: { marginBottom: 12 },
  sessionList: { paddingHorizontal: 16, paddingVertical: 4 },
  sessionText: { gap: 3 },
});
