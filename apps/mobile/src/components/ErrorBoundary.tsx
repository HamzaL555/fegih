import { Component, ReactNode, useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import i18next from 'i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

/**
 * Catches JavaScript errors in its child component tree and renders a
 * fallback UI instead of a completely white screen.
 *
 * Without an error boundary, a single throwing component (e.g. a Reanimated
 * worklet failure, an SVG rendering issue, or an unexpected null reference)
 * unmounts the entire React tree and leaves the user with a blank screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): { error: Error | null } {
    return { error };
  }

  override render() {
    const t = (key: string) => i18next.t(key);

    if (this.state.error) {
      return (
        <Card style={styles.stateCard}>
          <AppText variant="subtitle" color="#B42318">
            {t('remote.errorTitle')}
          </AppText>
          <AppText color="#607574" style={styles.message}>
            {this.state.error.message ?? t('errors.generic')}
          </AppText>
          <Button label={t('common.retry')} onPress={() => this.setState({ error: null })} variant="secondary" />
        </Card>
      );
    }
    return this.props.children;
  }
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
  stateCard: { marginTop: 12, padding: 16 },
  message: { marginVertical: 12 },
});
