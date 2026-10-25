import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/RemoteState';
import { TextField } from '@/components/TextField';
import { messagesApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import type { MessageThread } from '@/types/domain';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'messages.statusOpen',
  ANSWERED: 'messages.statusAnswered',
  CLOSED: 'messages.statusClosed',
};

/**
 * How often the inbox re-checks for a reply. Polling (rather than a socket) is
 * what Expo Go supports without an extra service, and the endpoint is cheap.
 */
const LIVE_POLL_MS = 10_000;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return 'indi';
  if (minutes < 60) return `${minutes} dəq`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat`;
  return `${Math.round(hours / 24)} gün`;
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<unknown>();

  const listQuery = useRemoteQuery({
    queryKey: ['messages'],
    queryFn: messagesApi.list,
    staleTime: 30_000,
    // Admin replies show up without a manual pull-to-refresh. Polling is what
    // Expo Go supports without standing up a socket service.
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const createMutation = useMutation({
    mutationFn: messagesApi.create,
    onSuccess: async () => {
      setComposing(false);
      setSubject('');
      setBody('');
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: setError,
  });

  const threads = useMemo(() => listQuery.data?.threads ?? [], [listQuery.data]);
  const unreadCount = listQuery.data?.unreadCount ?? 0;

  const submit = () => {
    setError(undefined);
    if (subject.trim().length < 3) {
      setError(new Error(t('messages.subjectRequired')));
      return;
    }
    if (body.trim().length < 3) {
      setError(new Error(t('messages.bodyRequired')));
      return;
    }
    createMutation.mutate({ subject: subject.trim(), body: body.trim() });
  };

  return (
    <AppScreen
      title={t('messages.title')}
      subtitle={t('messages.subtitle')}
      refreshing={listQuery.isRefetching}
      onRefresh={() => void listQuery.refetch()}
    >
      {unreadCount > 0 ? (
        <View style={[styles.unreadBanner, { backgroundColor: colors.surfaceElevated }]}>
          <AppText variant="label" color={colors.primary}>
            {t('messages.unread', { count: unreadCount })}
          </AppText>
        </View>
      ) : null}

      {composing ? (
        <Card style={styles.compose}>
          <AppText variant="subtitle">{t('messages.newMessage')}</AppText>
          <TextField
            label={t('messages.subject')}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('messages.subjectPlaceholder')}
            maxLength={200}
          />
          <TextField
            label={t('messages.message')}
            value={body}
            onChangeText={setBody}
            placeholder={t('messages.bodyPlaceholder')}
            multiline
            numberOfLines={5}
            maxLength={5000}
          />
          {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
          <View style={styles.composeActions}>
            <Button label={t('common.cancel')} onPress={() => { setComposing(false); setError(undefined); }} variant="ghost" style={styles.flex} />
            <Button label={t('messages.send')} onPress={submit} loading={createMutation.isPending} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <Button label={t('messages.newMessage')} onPress={() => setComposing(true)} style={styles.newButton} />
      )}

      {listQuery.isPending ? <LoadingState /> : null}
      {listQuery.isError ? <ErrorBanner error={listQuery.error} onDismiss={() => void listQuery.refetch()} /> : null}
      {!listQuery.isPending && !listQuery.isError && threads.length === 0 ? (
        <Card>
          <AppText variant="subtitle">{t('messages.emptyTitle')}</AppText>
          <AppText color={colors.textMuted} style={styles.emptyBody}>{t('messages.emptyDescription')}</AppText>
        </Card>
      ) : null}

      <View style={styles.list}>
        {threads.map((thread: MessageThread) => (
          <Pressable
            key={thread.id}
            accessibilityRole="button"
            onPress={() => router.push(`/messages/${thread.id}` as never)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? colors.surfaceElevated : colors.surface, borderColor: thread.unread > 0 ? colors.primary : colors.border },
            ]}
          >
            <View style={styles.rowHeader}>
              <AppText variant="subtitle" color={thread.unread > 0 ? colors.primary : colors.text} style={styles.subject}>
                {thread.subject}
              </AppText>
              {thread.unread > 0 ? (
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              ) : null}
            </View>
            {thread.lastMessage ? (
              <AppText color={colors.textMuted} numberOfLines={2} style={styles.preview}>
                {thread.lastMessage.authorRole === 'ADMIN' ? `${t('messages.admin')}: ` : ''}
                {thread.lastMessage.body}
              </AppText>
            ) : null}
            <View style={styles.rowFooter}>
              <AppText variant="caption" color={colors.textMuted}>{relativeTime(thread.lastMessageAt)}</AppText>
              <AppText variant="caption" color={colors.textMuted}>{t(STATUS_LABELS[thread.status] ?? 'messages.statusOpen')}</AppText>
            </View>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  unreadBanner: { borderRadius: 12, padding: 12, marginBottom: 12 },
  newButton: { marginBottom: 14 },
  compose: { marginBottom: 16, gap: 10 },
  composeActions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  list: { gap: 10 },
  row: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  preview: { marginTop: 2 },
  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  emptyBody: { marginTop: 6 },
});