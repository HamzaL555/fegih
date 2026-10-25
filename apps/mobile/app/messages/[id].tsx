import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

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
import type { MessageItem } from '@/types/domain';

function clockOf(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Matches the inbox cadence so both screens agree on when a reply lands. */
const LIVE_POLL_MS = 10_000;

export default function MessageThreadScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const threadId = params.id ?? '';
  const [body, setBody] = useState('');
  const [error, setError] = useState<unknown>();

  const query = useRemoteQuery({
    queryKey: ['messages', threadId],
    queryFn: () => messagesApi.detail(threadId),
    enabled: !!threadId,
    staleTime: 15_000,
    // An admin reply drops into the open conversation without a refresh.
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const replyMutation = useMutation({
    mutationFn: (text: string) => messagesApi.reply(threadId, text),
    onSuccess: async () => {
      setBody('');
      setError(undefined);
      // Refreshes the detail view and the inbox badge in one go.
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: setError,
  });

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    replyMutation.mutate(text);
  };

  const thread = query.data;
  const closed = thread?.status === 'CLOSED';

  return (
    <AppScreen title={thread?.subject ?? t('messages.title')} onRefresh={() => void query.refetch()}>
      <Button label={t('common.back')} onPress={() => router.back()} variant="ghost" style={styles.back} />

      {query.isPending ? <LoadingState /> : null}
      {query.isError ? <ErrorBanner error={query.error} onDismiss={() => void query.refetch()} /> : null}

      {thread ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
          <Card style={styles.thread}>
            {closed ? (
              <View style={[styles.closed, { backgroundColor: colors.surfaceElevated }]}>
                <AppText variant="caption" color={colors.textMuted}>{t('messages.closedNotice')}</AppText>
              </View>
            ) : null}
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {thread.messages.map((message: MessageItem, index: number) => {
                const fromAdmin = message.authorRole === 'ADMIN';
                const previous = thread.messages[index - 1];
                // Group by author so a run of replies does not repeat the label.
                const showAuthor = !previous || previous.authorRole !== message.authorRole;
                return (
                  <View
                    key={message.id}
                    style={[
                      styles.bubble,
                      fromAdmin ? styles.bubbleAdmin : styles.bubbleUser,
                      { marginTop: showAuthor ? 12 : 4, backgroundColor: fromAdmin ? colors.surfaceElevated : 'transparent' },
                    ]}
                  >
                    {showAuthor ? (
                      <AppText variant="caption" color={fromAdmin ? colors.primary : colors.textMuted}>
                        {fromAdmin ? t('messages.admin') : t('messages.you')}
                      </AppText>
                    ) : null}
                    <AppText>{message.body}</AppText>
                    <AppText variant="caption" color={colors.textMuted}>{clockOf(message.createdAt)}</AppText>
                  </View>
                );
              })}
            </ScrollView>
          </Card>

          {closed ? null : (
            <View style={styles.reply}>
              <TextField
                label={t('messages.reply')}
                value={body}
                onChangeText={setBody}
                placeholder={t('messages.replyPlaceholder')}
                multiline
                numberOfLines={3}
                maxLength={5000}
              />
              {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
              <Button label={t('messages.sendReply')} onPress={submit} loading={replyMutation.isPending} disabled={!body.trim()} />
            </View>
          )}
        </KeyboardAvoidingView>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: 8 },
  thread: { paddingVertical: 12 },
  scroll: { maxHeight: 420 },
  scrollContent: { paddingVertical: 4 },
  bubble: { borderRadius: 14, padding: 12, gap: 4, maxWidth: '90%' },
  bubbleUser: { alignSelf: 'flex-end' },
  bubbleAdmin: { alignSelf: 'flex-start' },
  closed: { borderRadius: 12, padding: 10, marginBottom: 10 },
  reply: { gap: 10, marginTop: 14 },
});