import { router } from 'expo-router';
import { Component, ReactNode, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import i18next from 'i18next';

/**
 * Catches JavaScript errors in its child component tree and renders a
 * fallback UI instead of a completely white screen.
 *
 * IMPORTANT: the fallback must not use `useTheme`, `AppText`, `Card`, `Button`
 * or `AppScreen`. The root boundary sits *outside* `ThemeProvider` (see
 * `app/_layout.tsx`), so any of those would throw
 * "useTheme must be used inside ThemeProvider" while React is already handling
 * the first error — and that second error unmounts the whole app. The fallback
 * therefore uses only plain React Native primitives.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): { error: Error | null } {
    return { error };
  }

  override componentDidCatch(error: Error) {
    // Keep the real error visible in the console/logs instead of swallowing it.
    console.error('[Fegih] Unhandled UI error:', error);
  }

  override render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

/** True in Expo development builds and `expo start`; replaced with `false` in production. */
const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Navigate to the screen that was visible before the failure. Expo Router owns
 * the native history, so prefer it; the browser fallback covers the case where
 * the boundary is mounted before the router is ready.
 */
function goToPreviousPage() {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  } catch (navigationError) {
    console.error('[Fegih] Could not navigate back from the error screen:', navigationError);
    if (typeof window !== 'undefined' && window.location) {
      if (window.history.length > 1) window.history.back();
      else window.location.replace('/');
    }
  }
}

function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const dark = useColorScheme() === 'dark';
  const palette = dark
    ? { background: '#0C1717', surface: '#142424', text: '#F0F7F5', muted: '#A7BFBA', danger: '#FF8D85', primary: '#4DB6AC', border: '#294442' }
    : { background: '#F5F8F7', surface: '#FFFFFF', text: '#102A2A', muted: '#607574', danger: '#B42318', primary: '#0F766E', border: '#D5E2DF' };

  return (
    <View style={[styles.page, { backgroundColor: palette.background }]} accessibilityRole="alert">
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.danger }]}>{i18next.t('remote.errorTitle')}</Text>
        {isDevelopment ? (
          <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
            <Text selectable style={[styles.message, { color: palette.text }]}>
              {error.message || i18next.t('errors.generic')}
            </Text>
            {error.stack ? (
              <Text selectable style={[styles.stack, { color: palette.muted }]}>
                {error.stack}
              </Text>
            ) : null}
          </ScrollView>
        ) : (
          <Text style={[styles.message, { color: palette.muted }]}>{i18next.t('errors.generic')}</Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.button, { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.buttonLabel}>{i18next.t('common.retry')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={goToPreviousPage} style={styles.link}>
          <Text style={[styles.linkLabel, { color: palette.primary }]}>{i18next.t('common.back')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Hook-based error reporting for functional components. Provides a
 * `captureError` callback that can be passed to error-prone callbacks
 * (e.g. `useEffect` cleanup, event handlers) so unexpected exceptions are
 * surfaced consistently.
 */
export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);

  const captureError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e : new Error(String(e)));
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { error, captureError, reset, hasError: !!error };
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 560, maxHeight: '90%', borderWidth: 1, borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  details: { maxHeight: 260, marginBottom: 18 },
  detailsContent: { gap: 10 },
  message: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  stack: { fontSize: 12, lineHeight: 17, fontFamily: 'monospace' },
  button: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  link: { marginTop: 14, alignItems: 'center', paddingVertical: 6 },
  linkLabel: { fontSize: 14, fontWeight: '600' },
});
